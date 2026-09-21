import { useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '@/features/auth';
import {
  ResetPasswordDialog,
  UserFormDialog,
  UsersTable,
} from '@/features/user-management';
import {
  UserService,
  type PageData,
  type UserRecord,
  type UserRole,
  type UserStatus,
} from '@/service/user';
import { Button, Input } from '@/shared/ui';

const PAGE_SIZE = 20;

interface UserQuery {
  current: number;
  keyword?: string;
  role?: UserRole;
  status?: UserStatus;
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState<UserQuery>({ current: 1 });
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState<PageData<UserRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formUser, setFormUser] = useState<UserRecord | null | undefined>(
    undefined,
  );
  const [resetUser, setResetUser] = useState<UserRecord | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void UserService.queryUser(
      {
        current: query.current,
        pageSize: PAGE_SIZE,
        keyword: query.keyword,
        role: query.role,
        status: query.status,
      },
      controller.signal,
    )
      .then(setPage)
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load users.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [query, refreshKey]);

  if (!currentUser) return null;

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = keyword.trim();
    setQuery((current) => ({
      ...current,
      current: 1,
      keyword: normalized || undefined,
    }));
  }

  function refresh(firstPage = false) {
    if (firstPage && query.current !== 1) {
      setQuery((current) => ({ ...current, current: 1 }));
      return;
    }
    setRefreshKey((current) => current + 1);
  }

  async function toggleStatus(user: UserRecord) {
    if (busyUserId) return;

    setBusyUserId(user.id);
    setError(null);
    try {
      await UserService.updateUserStatus(user.id, {
        status: user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
      });
      refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update user status.',
      );
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-[-0.03em]">
            Users
          </h1>
          <p className="mb-0 mt-2 text-sm text-foreground-subtle">
            Manage the accounts that can sign in to Yakable.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setFormUser(null)}
        >
          Add user
        </Button>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <form
          className="flex min-w-64 flex-1 items-center gap-2"
          onSubmit={search}
        >
          <Input
            aria-label="Search users"
            placeholder="Search username, name or email"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Button type="submit">Search</Button>
        </form>

        <select
          aria-label="Filter by role"
          value={query.role ?? ''}
          onChange={(event) =>
            setQuery((current) => ({
              ...current,
              current: 1,
              role: (event.target.value || undefined) as UserRole | undefined,
            }))
          }
          className="h-9 rounded-lg border border-border-control bg-surface px-3 text-sm text-foreground outline-none focus:border-border-focus focus:outline-2 focus:outline-offset-1 focus:outline-focus-ring-soft"
        >
          <option value="">All roles</option>
          <option value="ADMIN">Admin</option>
          <option value="USER">User</option>
        </select>

        <select
          aria-label="Filter by status"
          value={query.status ?? ''}
          onChange={(event) =>
            setQuery((current) => ({
              ...current,
              current: 1,
              status: (event.target.value || undefined) as
                | UserStatus
                | undefined,
            }))
          }
          className="h-9 rounded-lg border border-border-control bg-surface px-3 text-sm text-foreground outline-none focus:border-border-focus focus:outline-2 focus:outline-offset-1 focus:outline-focus-ring-soft"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DISABLED">Disabled</option>
        </select>
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-danger-border-subtle bg-danger-surface px-3 py-2 text-sm text-danger-foreground"
        >
          {error}
        </p>
      ) : null}

      {loading && !page ? (
        <div
          className="flex min-h-52 items-center justify-center rounded-xl border border-border-quiet text-sm text-foreground-subtle"
          role="status"
        >
          Loading users…
        </div>
      ) : (
        <UsersTable
          users={page?.records ?? []}
          currentUserId={currentUser.id}
          busyUserId={busyUserId}
          onEdit={(user) => setFormUser(user)}
          onToggleStatus={(user) => void toggleStatus(user)}
          onResetPassword={setResetUser}
        />
      )}

      {page ? (
        <div className="mt-4 flex items-center justify-between gap-4 text-sm text-foreground-subtle">
          <span>
            {page.total} {page.total === 1 ? 'user' : 'users'}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={page.current <= 1 || loading}
              onClick={() =>
                setQuery((current) => ({
                  ...current,
                  current: Math.max(1, current.current - 1),
                }))
              }
            >
              Previous
            </Button>
            <span>
              Page {page.current} of {Math.max(1, page.pages)}
            </span>
            <Button
              size="sm"
              disabled={page.current >= page.pages || loading}
              onClick={() =>
                setQuery((current) => ({
                  ...current,
                  current: current.current + 1,
                }))
              }
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {formUser !== undefined ? (
        <UserFormDialog
          user={formUser}
          currentUserId={currentUser.id}
          onClose={() => setFormUser(undefined)}
          onSaved={() => {
            const adding = formUser === null;
            setFormUser(undefined);
            refresh(adding);
          }}
        />
      ) : null}

      {resetUser ? (
        <ResetPasswordDialog
          user={resetUser}
          onClose={() => setResetUser(null)}
          onReset={() => {
            setResetUser(null);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}
