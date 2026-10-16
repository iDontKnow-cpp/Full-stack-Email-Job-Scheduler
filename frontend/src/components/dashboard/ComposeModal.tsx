import React, { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import {
  UploadCloud,
  FileText,
  X,
  Mail,
  Clock,
  ShieldAlert,
  Send,
  Users,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useScheduleEmails } from '../../hooks/useEmails';
import { useAuth } from '../../hooks/useAuth';

export interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const scheduleMutation = useScheduleEmails();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [manualRecipient, setManualRecipient] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);

  // Default start time to now + 2 minutes formatted for datetime-local (YYYY-MM-DDTHH:mm)
  const getInitialStartTime = () => {
    const d = new Date(Date.now() + 2 * 60 * 1000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const [startTime, setStartTime] = useState(getInitialStartTime());
  const [delaySeconds, setDelaySeconds] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(200);

  const [isDragging, setIsDragging] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize sender email from logged in user
  useEffect(() => {
    if (user?.email && !senderEmail) {
      setSenderEmail(user.email);
    }
  }, [user, senderEmail]);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setStartTime(getInitialStartTime());
      setFormErrors({});
    }
  }, [isOpen]);

  const extractEmailsFromParsedData = (data: any[]): string[] => {
    const foundEmails = new Set<string>();

    data.forEach((row) => {
      if (Array.isArray(row)) {
        row.forEach((cell) => {
          if (typeof cell === 'string') {
            const trimmed = cell.trim();
            if (EMAIL_REGEX.test(trimmed)) {
              foundEmails.add(trimmed.toLowerCase());
            }
          }
        });
      } else if (typeof row === 'object' && row !== null) {
        Object.values(row).forEach((val) => {
          if (typeof val === 'string') {
            const trimmed = val.trim();
            if (EMAIL_REGEX.test(trimmed)) {
              foundEmails.add(trimmed.toLowerCase());
            }
          }
        });
      }
    });

    return Array.from(foundEmails);
  };

  const processCsvFile = (file: File) => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      toast.error('Please upload a valid CSV file.');
      return;
    }

    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (results) => {
        const parsedEmails = extractEmailsFromParsedData(results.data);
        if (parsedEmails.length === 0) {
          toast.error('No valid email addresses found in the uploaded CSV.');
          return;
        }

        // Merge with existing recipients
        const merged = Array.from(new Set([...recipients, ...parsedEmails]));
        setRecipients(merged);
        setCsvFileName(file.name);
        toast.success(`Extracted ${parsedEmails.length} email addresses from CSV!`);
      },
      error: (error) => {
        toast.error(`Error parsing CSV: ${error.message}`);
      },
    });
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processCsvFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processCsvFile(e.target.files[0]);
    }
  };

  const handleAddManualRecipient = () => {
    const email = manualRecipient.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_REGEX.test(email)) {
      toast.error('Invalid email format');
      return;
    }
    if (recipients.includes(email)) {
      toast('Email already added', { icon: 'ℹ️' });
      return;
    }
    setRecipients([...recipients, email]);
    setManualRecipient('');
  };

  const handleRemoveRecipient = (emailToRemove: string) => {
    setRecipients(recipients.filter((email) => email !== emailToRemove));
  };

  const handleClearRecipients = () => {
    setRecipients([]);
    setCsvFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validate = () => {
    const errors: Record<string, string> = {};

    if (!subject.trim()) {
      errors.subject = 'Subject is required';
    }
    if (!body.trim()) {
      errors.body = 'Email body is required';
    }
    if (!senderEmail.trim()) {
      errors.senderEmail = 'Sender email is required';
    } else if (!EMAIL_REGEX.test(senderEmail.trim())) {
      errors.senderEmail = 'Invalid sender email address';
    }
    if (recipients.length === 0) {
      errors.recipients = 'At least one recipient is required (upload CSV or add manually)';
    }
    if (!startTime) {
      errors.startTime = 'Start time is required';
    } else {
      const selected = new Date(startTime).getTime();
      // Allow buffer of 30 seconds
      if (selected < Date.now() - 30000) {
        errors.startTime = 'Start time cannot be in the past';
      }
    }
    if (delaySeconds < 0) {
      errors.delaySeconds = 'Delay must be 0 or greater';
    }
    if (hourlyLimit < 1) {
      errors.hourlyLimit = 'Hourly limit must be at least 1';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the errors in the form.');
      return;
    }

    scheduleMutation.mutate(
      {
        subject: subject.trim(),
        body: body.trim(),
        recipients,
        senderEmail: senderEmail.trim(),
        startTime: new Date(startTime).toISOString(),
        delaySeconds: Number(delaySeconds),
        hourlyLimit: Number(hourlyLimit),
      },
      {
        onSuccess: (data) => {
          toast.success(
            `Campaign scheduled successfully! (${data.jobCount || recipients.length} jobs created)`
          );
          // Reset state and close modal
          setSubject('');
          setBody('');
          setRecipients([]);
          setCsvFileName(null);
          onClose();
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to schedule emails. Please try again.');
        },
      }
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Compose & Schedule Campaign"
      description="Create a bulk email job with custom throttle delays, rate limits, and scheduling."
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Sender Email & Subject */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Sender Email"
            type="email"
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            placeholder="you@company.com"
            error={formErrors.senderEmail}
            required
          />
          <Input
            label="Subject Line"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Announcing our latest feature!"
            error={formErrors.subject}
            required
          />
        </div>

        {/* Recipients CSV Upload & Manual Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Recipients <span className="text-red-500">*</span>
          </label>

          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-primary-500 bg-primary-50/50'
                : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <div className="flex flex-col items-center justify-center">
              <UploadCloud className="w-8 h-8 text-primary-500 mb-2" />
              <p className="text-sm font-medium text-gray-700">
                Click to upload or drag & drop CSV file
              </p>
              <p className="text-xs text-gray-400 mt-1">
                CSV file should contain a column of recipient email addresses
              </p>
            </div>
          </div>

          {/* Or Manual Recipient Entry */}
          <div className="mt-2 flex gap-2">
            <input
              type="email"
              value={manualRecipient}
              onChange={(e) => setManualRecipient(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddManualRecipient();
                }
              }}
              placeholder="Or add single recipient email..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddManualRecipient}
              className="text-xs"
            >
              Add
            </Button>
          </div>

          {formErrors.recipients && (
            <p className="mt-1.5 text-xs text-red-600 font-medium">
              {formErrors.recipients}
            </p>
          )}

          {/* Recipient Count & Previews */}
          {recipients.length > 0 && (
            <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700 flex items-center">
                  <Users className="w-3.5 h-3.5 mr-1.5 text-primary-600" />
                  {recipients.length} Recipient{recipients.length > 1 ? 's' : ''} Loaded
                  {csvFileName && (
                    <span className="ml-2 font-normal text-gray-500">
                      (from {csvFileName})
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleClearRecipients}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Clear all
                </button>
              </div>

              {/* Preview of first 5 recipients */}
              <div className="flex flex-wrap gap-1.5">
                {recipients.slice(0, 5).map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-white text-gray-700 border border-gray-200 shadow-2xs"
                  >
                    <Mail className="w-3 h-3 text-gray-400 mr-1" />
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(email)}
                      className="ml-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {recipients.length > 5 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-200 text-gray-600">
                    +{recipients.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Email Body */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Content (Body) <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your email body here. HTML formatting or plain text supported..."
            className={`block w-full rounded-lg border text-sm p-3 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 transition-colors ${
              formErrors.body
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
            }`}
          />
          {formErrors.body && (
            <p className="mt-1 text-xs text-red-600 font-medium">{formErrors.body}</p>
          )}
        </div>

        {/* Schedule & Throttling Settings */}
        <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 space-y-3">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-primary-900 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-primary-600" />
            <span>Scheduling & Rate Limits</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              {formErrors.startTime && (
                <p className="mt-1 text-[11px] text-red-600">{formErrors.startTime}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Delay Between Emails (sec)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              {formErrors.delaySeconds && (
                <p className="mt-1 text-[11px] text-red-600">{formErrors.delaySeconds}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Hourly Limit (max/hr)
              </label>
              <input
                type="number"
                min="1"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              {formErrors.hourlyLimit && (
                <p className="mt-1 text-[11px] text-red-600">{formErrors.hourlyLimit}</p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-2 flex items-center justify-end space-x-3 border-t border-gray-100">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={scheduleMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={scheduleMutation.isPending}
            leftIcon={<Send className="w-4 h-4" />}
          >
            Schedule Campaign
          </Button>
        </div>
      </form>
    </Modal>
  );
};
