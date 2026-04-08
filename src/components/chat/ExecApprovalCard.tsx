'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/trpc';

interface ExecApprovalRequest {
  id: string;
  command: string;
  host?: string;
  cwd?: string;
  expiresAt?: number;
  sessionKey?: string;
}

type ApprovalState =
  | { status: 'pending' }
  | { status: 'resolved'; decision: 'allow_once' | 'always_allow' | 'deny' };

function useCountdown(expiresAt?: number): string {
  const [remaining, setRemaining] = useState<number>(() => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      setRemaining(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!expiresAt) return '';
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${m}m ${s}s`;
}

interface ExecApprovalCardProps {
  approval: ExecApprovalRequest;
  onResolved?: (id: string, decision: string) => void;
}

export function ExecApprovalCard({ approval, onResolved }: ExecApprovalCardProps) {
  const [state, setState] = useState<ApprovalState>({ status: 'pending' });
  const countdown = useCountdown(approval.expiresAt);

  const resolveMutation = api.approvals.resolve.useMutation({
    onSuccess: (_data, variables) => {
      setState({ status: 'resolved', decision: variables.decision });
      onResolved?.(approval.id, variables.decision);
    },
  });

  const resolve = useCallback(
    (decision: 'allow_once' | 'always_allow' | 'deny') => {
      if (state.status === 'resolved') return;
      resolveMutation.mutate({ id: approval.id, decision });
    },
    [state.status, resolveMutation, approval.id],
  );

  const isPending = state.status === 'pending';
  const isExpired = approval.expiresAt ? Date.now() > approval.expiresAt : false;

  return (
    <div
      className="rounded-lg border overflow-hidden my-2"
      style={{
        background: '#161b22',
        borderColor: isPending && !isExpired ? '#d29922' : '#30363d',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b"
        style={{
          background: '#21262d',
          borderColor: '#30363d',
        }}
      >
        <Shield size={14} style={{ color: '#d29922' }} />
        <span className="text-sm font-medium" style={{ color: '#d29922' }}>
          Exec Approval Required
        </span>
        {approval.expiresAt && isPending && (
          <div className="ml-auto flex items-center gap-1">
            <Clock size={12} style={{ color: '#8b949e' }} />
            <span className="text-xs" style={{ color: isExpired ? '#f85149' : '#8b949e' }}>
              {isExpired ? 'Expired' : `Expires in ${countdown}`}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-3 space-y-2">
        {/* Command */}
        <div>
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>
            Command
          </span>
          <pre
            className="mt-1 text-xs rounded px-2 py-1.5 overflow-x-auto"
            style={{
              background: '#0d1117',
              color: '#e6edf3',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {approval.command}
          </pre>
        </div>

        {/* Meta */}
        <div className="flex gap-4">
          {approval.host && (
            <div>
              <span className="text-xs" style={{ color: '#8b949e' }}>Host: </span>
              <span className="text-xs font-mono" style={{ color: '#e6edf3' }}>{approval.host}</span>
            </div>
          )}
          {approval.cwd && (
            <div>
              <span className="text-xs" style={{ color: '#8b949e' }}>CWD: </span>
              <span className="text-xs font-mono" style={{ color: '#e6edf3' }}>{approval.cwd}</span>
            </div>
          )}
        </div>

        {/* Resolved state */}
        {state.status === 'resolved' && (
          <div className="flex items-center gap-2 pt-1">
            {state.decision !== 'deny' ? (
              <>
                <CheckCircle size={14} style={{ color: '#3fb950' }} />
                <span className="text-sm" style={{ color: '#3fb950' }}>
                  {state.decision === 'always_allow' ? 'Always allowed ✓' : 'Allowed once ✓'}
                </span>
              </>
            ) : (
              <>
                <XCircle size={14} style={{ color: '#f85149' }} />
                <span className="text-sm" style={{ color: '#f85149' }}>Denied ✗</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {isPending && !isExpired && (
        <div className="flex gap-2 px-4 pb-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => resolve('allow_once')}
            disabled={resolveMutation.isPending}
            className="text-xs"
            style={{
              background: 'transparent',
              borderColor: '#3fb950',
              color: '#3fb950',
            }}
          >
            Allow Once
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => resolve('always_allow')}
            disabled={resolveMutation.isPending}
            className="text-xs"
            style={{
              background: 'transparent',
              borderColor: '#58a6ff',
              color: '#58a6ff',
            }}
          >
            Always Allow
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => resolve('deny')}
            disabled={resolveMutation.isPending}
            className="text-xs ml-auto"
            style={{
              background: 'transparent',
              borderColor: '#f85149',
              color: '#f85149',
            }}
          >
            Deny
          </Button>
        </div>
      )}

      {isPending && isExpired && (
        <div className="px-4 pb-3">
          <span className="text-xs" style={{ color: '#8b949e' }}>
            This approval request has expired.
          </span>
        </div>
      )}
    </div>
  );
}
