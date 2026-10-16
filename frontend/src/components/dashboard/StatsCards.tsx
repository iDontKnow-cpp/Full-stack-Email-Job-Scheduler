import React from 'react';
import { Calendar, CheckCircle2, AlertOctagon } from 'lucide-react';
import { useEmailStats } from '../../hooks/useEmails';

export const StatsCards: React.FC = () => {
  const { data: stats, isLoading } = useEmailStats();

  const cards = [
    {
      title: 'Total Scheduled',
      value: stats?.totalScheduled ?? 0,
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-100',
      badge: 'Pending / In Queue',
    },
    {
      title: 'Total Sent',
      value: stats?.totalSent ?? 0,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-100',
      badge: 'Delivered',
    },
    {
      title: 'Total Failed',
      value: stats?.totalFailed ?? 0,
      icon: AlertOctagon,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-100',
      badge: 'Attention Needed',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{card.title}</p>
                {isLoading ? (
                  <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
                ) : (
                  <h3 className="text-3xl font-bold text-gray-900 tracking-tight">
                    {card.value.toLocaleString()}
                  </h3>
                )}
                <span className="inline-block mt-2 text-[11px] font-medium text-gray-400">
                  {card.badge}
                </span>
              </div>
              <div
                className={`w-14 h-14 rounded-2xl ${card.bgColor} ${card.color} flex items-center justify-center border ${card.borderColor} shadow-inner group-hover:scale-105 transition-transform`}
              >
                <Icon className="w-7 h-7" />
              </div>
            </div>
            {/* Top accent line */}
            <div
              className={`absolute top-0 left-0 right-0 h-1 ${card.bgColor} ${card.color.replace('text-', 'bg-')}`}
            />
          </div>
        );
      })}
    </div>
  );
};
