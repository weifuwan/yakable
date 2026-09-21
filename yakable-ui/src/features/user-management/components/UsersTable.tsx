import type { UserRecord } from '@/service/user';
import { Button } from '@/shared/ui';

interface UsersTableProps {
  users: UserRecord[];
  currentUserId: string;
  busyUserId: string | null;
  onEdit: (user: UserRecord) => void;
  onToggleStatus: (user: UserRecord) => void;
  onResetPassword: (user: UserRecord) => void;
}

function formatDate(value: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
}

function statusLabel(status: UserRecord['status']) {
  return status === 'ACTIVE' ? 'Active' : 'Disabled';
}

export function UsersTable({
  users,
  currentUserId,
  busyUserId,
  onEdit,
  onToggleStatus,
  onResetPassword,
}: UsersTableProps) {
  if (users.length === 0) {
    return (
      <div className="flex min-h-52 items-center justify-center rounded-xl border border-border-quiet text-sm text-foreground-subtle">
        No users found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-surface-hover-subtle text-xs font-medium text-foreground-subtle">
          <tr>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Username</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Last login</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const self = user.id === currentUserId;
            const busy = busyUserId === user.id;
            return (
              <tr key={user.id} className="border-t border-border-quiet">
                <td className="px-4 py-3">
                  <div className="min-w-36">
                    <div className="font-medium text-foreground">{user.name}</div>
                    <div className="mt-0.5 text-xs text-foreground-subtle">
                      {user.email || 'No email'}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-foreground-secondary">
                  {user.username}
                  {self ? (
                    <span className="ml-2 text-xs text-foreground-subtle">
                      You
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {user.role === 'ADMIN' ? 'Admin' : 'User'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      user.status === 'ACTIVE'
                        ? 'text-success'
                        : 'text-foreground-subtle'
                    }
                  >
                    {statusLabel(user.status)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-foreground-subtle">
                  {formatDate(user.lastLoginAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-foreground-subtle">
                  {formatDate(user.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" onClick={() => onEdit(user)} disabled={busy}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onResetPassword(user)}
                      disabled={busy || self}
                    >
                      Reset password
                    </Button>
                    <Button
                      size="sm"
                      variant={user.status === 'ACTIVE' ? 'destructive' : 'secondary'}
                      onClick={() => onToggleStatus(user)}
                      disabled={busy || self}
                    >
                      {busy
                        ? 'Updating…'
                        : user.status === 'ACTIVE'
                          ? 'Disable'
                          : 'Enable'}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
