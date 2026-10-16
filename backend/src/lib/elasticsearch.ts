import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';
import { EmailDocument } from '../types';

export const esClient = new Client({
  node: env.ELASTICSEARCH_URL,
});

export const EMAILS_INDEX = 'emails';

export async function initElasticsearch(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: EMAILS_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: EMAILS_INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            campaignId: { type: 'keyword' },
            to: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword', ignore_above: 256 },
              },
            },
            subject: { type: 'text' },
            body: { type: 'text' },
            senderEmail: { type: 'keyword' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            etherealUrl: { type: 'keyword' },
            error: { type: 'text' },
          },
        },
      });
      console.log(`🔍 Elasticsearch index "${EMAILS_INDEX}" created successfully.`);
    } else {
      console.log(`🔍 Elasticsearch index "${EMAILS_INDEX}" already exists.`);
    }
  } catch (error: any) {
    console.warn('⚠️ Elasticsearch initialization warning (service may be offline):', error.message);
  }
}

export async function indexEmail(email: EmailDocument): Promise<void> {
  try {
    await esClient.index({
      index: EMAILS_INDEX,
      id: email.id,
      document: {
        id: email.id,
        userId: email.userId,
        campaignId: email.campaignId || null,
        to: email.to,
        subject: email.subject,
        body: email.body,
        senderEmail: email.senderEmail,
        status: email.status,
        scheduledAt: email.scheduledAt instanceof Date ? email.scheduledAt.toISOString() : email.scheduledAt,
        sentAt: email.sentAt ? (email.sentAt instanceof Date ? email.sentAt.toISOString() : email.sentAt) : null,
        etherealUrl: email.etherealUrl || null,
        error: email.error || null,
      },
      refresh: 'wait_for',
    });
  } catch (error: any) {
    console.warn(`⚠️ Failed to index email ${email.id} in Elasticsearch:`, error.message);
  }
}

export async function updateEmailStatus(
  id: string,
  status: string,
  sentAt?: Date | null,
  etherealUrl?: string | null,
  error?: string | null
): Promise<void> {
  try {
    const docUpdates: Record<string, any> = { status };
    if (sentAt !== undefined) {
      docUpdates.sentAt = sentAt ? (sentAt instanceof Date ? sentAt.toISOString() : sentAt) : null;
    }
    if (etherealUrl !== undefined) {
      docUpdates.etherealUrl = etherealUrl;
    }
    if (error !== undefined) {
      docUpdates.error = error;
    }

    await esClient.update({
      index: EMAILS_INDEX,
      id,
      doc: docUpdates,
      doc_as_upsert: true,
      refresh: 'wait_for',
    });
  } catch (err: any) {
    console.warn(`⚠️ Failed to update email ${id} status in Elasticsearch:`, err.message);
  }
}

export async function searchEmails(
  query: string,
  userId: string,
  page: number = 1,
  limit: number = 20,
  statusFilter?: string[]
): Promise<{ total: number; hits: EmailDocument[] }> {
  try {
    const from = (page - 1) * limit;

    const mustClauses: any[] = [
      {
        term: { userId: userId },
      },
    ];

    if (query && query.trim() !== '') {
      mustClauses.push({
        multi_match: {
          query,
          fields: ['subject^3', 'body', 'to^2', 'senderEmail'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (statusFilter && statusFilter.length > 0) {
      mustClauses.push({
        terms: {
          status: statusFilter,
        },
      });
    }

    const response = await esClient.search({
      index: EMAILS_INDEX,
      from,
      size: limit,
      query: {
        bool: {
          must: mustClauses,
        },
      },
      sort: [{ scheduledAt: { order: 'desc' } }],
    });

    const totalValue =
      typeof response.hits.total === 'number'
        ? response.hits.total
        : response.hits.total?.value || 0;

    const hits: EmailDocument[] = response.hits.hits.map((hit: any) => hit._source as EmailDocument);

    return { total: totalValue, hits };
  } catch (error: any) {
    console.warn('⚠️ Elasticsearch search error:', error.message);
    return { total: 0, hits: [] };
  }
}
