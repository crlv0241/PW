import React, { useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { AppLayout } from '../../../layouts/app-layout';
import {
    UsersIcon,
    ShieldCheckIcon,
    PlusIcon,
    SearchIcon,
    FilterIcon,
    EditIcon,
    PowerIcon,
    CheckIcon,
    XIcon,
    SpinnerIcon,
} from '../../../components/ui/icons';
import { Combobox } from '../../../components/ui/combobox';
import { Modal } from '../../../components/ui/modal';

interface UserItem {
    id: number;
    name: string;
    email: string;
    is_active: boolean;
    created_at: string;
    primary_role: string;
    role_id: number;
    role_name: string;
    is_super_admin: boolean;
}

interface RoleItem {
    id: number;
    name: string;
    display_name: string;
    description: string | null;
}

interface PaginatedUsers {
    data: UserItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
    links: { url: string | null; label: string; active: boolean }[];
}

interface Props {
    users: PaginatedUsers;
    roles: RoleItem[];
    filters: {
        search: string;
        role: string;
    };
}

export default function UserManagement({ users, roles, filters }: Props) {
    const pageProps = usePage().props as { auth?: { user?: { id: number } } };
    const currentUserId = pageProps.auth?.user?.id;

    // Filters state
    const [search, setSearch] = useState(filters.search || '');
    const [selectedRole, setSelectedRole] = useState(filters.role || '');

    // Modals state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserItem | null>(null);
    const [toggleUserTarget, setToggleUserTarget] = useState<UserItem | null>(null);

    // Create User Form
    const createForm = useForm({
        name: '',
        email: '',
        password: '',
        role_id: roles[0]?.id ? String(roles[0].id) : '',
        is_active: true,
    });

    // Edit User Form
    const editForm = useForm({
        name: '',
        email: '',
        password: '',
        role_id: '',
        is_active: true,
    });

    // Apply Filters
    const handleFilterSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        router.get(
            '/admin/users',
            {
                search: search || undefined,
                role: selectedRole || undefined,
            },
            {
                preserveState: true,
                replace: true,
            }
        );
    };

    const handleRoleFilterChange = (roleValue: string) => {
        setSelectedRole(roleValue);
        router.get(
            '/admin/users',
            {
                search: search || undefined,
                role: roleValue || undefined,
            },
            {
                preserveState: true,
                replace: true,
            }
        );
    };

    // Open Edit Modal
    const handleOpenEdit = (user: UserItem) => {
        setEditingUser(user);
        editForm.setData({
            name: user.name,
            email: user.email,
            password: '',
            role_id: String(user.role_id),
            is_active: user.is_active,
        });
    };

    // Submit Create User
    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post('/admin/users', {
            onSuccess: () => {
                setIsCreateModalOpen(false);
                createForm.reset();
            },
        });
    };

    // Submit Edit User
    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        editForm.put(`/admin/users/${editingUser.id}`, {
            onSuccess: () => {
                setEditingUser(null);
                editForm.reset();
            },
        });
    };

    // Confirm Toggle Active
    const handleConfirmToggleActive = () => {
        if (!toggleUserTarget) return;

        router.patch(
            `/admin/users/${toggleUserTarget.id}/toggle-active`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => setToggleUserTarget(null),
            }
        );
    };

    const roleFilterOptions = [
        { value: '', label: 'All Roles' },
        ...roles.map((r) => ({
            value: r.name,
            label: r.display_name,
            description: r.description || undefined,
        })),
    ];

    const roleSelectionOptions = roles.map((r) => ({
        value: String(r.id),
        label: r.display_name,
        description: r.description || undefined,
    }));

    const getRoleBadgeClasses = (roleName: string) => {
        switch (roleName) {
            case 'super_admin':
                return 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20';
            case 'warehouse_manager':
                return 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20';
            case 'warehouse_scanner':
                return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
            case 'route_agent':
                return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
            case 'accountant':
                return 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20';
            default:
                return 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20';
        }
    };

    return (
        <AppLayout
            title="User & Access Control"
            breadcrumbs={[
                { label: 'Admin Console', href: '/admin/users' },
                { label: 'System Users' },
            ]}
        >
            <Head title="System Users - Super Admin" />

            <div className="space-y-6">
                {/* Header Metrics */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                                <UsersIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total System Users</p>
                                <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{users.total}</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                                <CheckIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Operators</p>
                                <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                    {users.data.filter((u) => u.is_active).length} (Page)
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                                <ShieldCheckIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">RBAC Roles Defined</p>
                                <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{roles.length}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filter and Action Bar */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <form onSubmit={handleFilterSubmit} className="flex flex-1 items-center gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by name or email..."
                                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div className="w-56">
                            <Combobox
                                options={roleFilterOptions}
                                value={selectedRole}
                                onChange={handleRoleFilterChange}
                                placeholder="Filter by Role"
                            />
                        </div>

                        <button
                            type="submit"
                            className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                        >
                            Filter
                        </button>
                    </form>

                    <button
                        type="button"
                        onClick={() => setIsCreateModalOpen(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                    >
                        <PlusIcon className="h-4 w-4" />
                        <span>Add New User</span>
                    </button>
                </div>

                {/* Users Table */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
                            <thead className="bg-slate-50 font-semibold text-slate-600 dark:bg-slate-950/50 dark:text-slate-400">
                                <tr>
                                    <th className="px-5 py-3.5">Operator</th>
                                    <th className="px-5 py-3.5">Assigned Role</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5">Registered</th>
                                    <th className="px-5 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {users.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                                            No users found matching the given criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    users.data.map((user) => (
                                        <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white shadow-inner">
                                                        {user.name
                                                            .split(' ')
                                                            .map((n) => n[0])
                                                            .slice(0, 2)
                                                            .join('')}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                                            <span>{user.name}</span>
                                                            {user.id === currentUserId && (
                                                                <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                                    You
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{user.email}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-5 py-4">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${getRoleBadgeClasses(
                                                        user.role_name
                                                    )}`}
                                                >
                                                    <ShieldCheckIcon className="h-3 w-3" />
                                                    <span>{user.primary_role}</span>
                                                </span>
                                            </td>

                                            <td className="px-5 py-4">
                                                {user.is_active ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                        <span>Active</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                                        <span>Deactivated</span>
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                                                {user.created_at}
                                            </td>

                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEdit(user)}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                                                    >
                                                        <EditIcon className="h-3.5 w-3.5" />
                                                        <span>Edit</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => setToggleUserTarget(user)}
                                                        disabled={user.id === currentUserId}
                                                        title={
                                                            user.id === currentUserId
                                                                ? 'You cannot deactivate yourself'
                                                                : user.is_active
                                                                ? 'Deactivate User'
                                                                : 'Activate User'
                                                        }
                                                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                                            user.is_active
                                                                ? 'border-rose-200 bg-rose-50/50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-950/50'
                                                                : 'border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-950/50'
                                                        }`}
                                                    >
                                                        <PowerIcon className="h-3.5 w-3.5" />
                                                        <span>{user.is_active ? 'Deactivate' : 'Activate'}</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {users.links.length > 3 && (
                        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-xs dark:border-slate-800">
                            <span className="text-slate-500">
                                Showing <span className="font-semibold">{users.data.length}</span> of{' '}
                                <span className="font-semibold">{users.total}</span> users
                            </span>
                            <div className="flex items-center gap-1">
                                {users.links.map((link, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => link.url && router.visit(link.url)}
                                        disabled={!link.url || link.active}
                                        className={`rounded-md px-3 py-1 font-medium transition-colors ${
                                            link.active
                                                ? 'bg-indigo-600 text-white'
                                                : link.url
                                                ? 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                                                : 'text-slate-400 opacity-50 cursor-not-allowed'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Create User Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Register New System User"
                description="Create a new operator account and assign their security clearance role."
                maxWidth="md"
            >
                <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Full Name
                        </label>
                        <input
                            type="text"
                            required
                            value={createForm.data.name}
                            onChange={(e) => createForm.setData('name', e.target.value)}
                            placeholder="e.g. Maria Santos"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                        {createForm.errors.name && (
                            <p className="mt-1 text-xs text-rose-500">{createForm.errors.name}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Email Address
                        </label>
                        <input
                            type="email"
                            required
                            value={createForm.data.email}
                            onChange={(e) => createForm.setData('email', e.target.value)}
                            placeholder="maria@poswms.test"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                        {createForm.errors.email && (
                            <p className="mt-1 text-xs text-rose-500">{createForm.errors.email}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Initial Password
                        </label>
                        <input
                            type="password"
                            required
                            value={createForm.data.password}
                            onChange={(e) => createForm.setData('password', e.target.value)}
                            placeholder="Minimum 8 characters"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                        {createForm.errors.password && (
                            <p className="mt-1 text-xs text-rose-500">{createForm.errors.password}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Role Clearance
                        </label>
                        <Combobox
                            options={roleSelectionOptions}
                            value={createForm.data.role_id}
                            onChange={(val) => createForm.setData('role_id', val)}
                            placeholder="Select Role"
                            error={createForm.errors.role_id}
                        />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                        <input
                            type="checkbox"
                            id="create_is_active"
                            checked={createForm.data.is_active}
                            onChange={(e) => createForm.setData('is_active', e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                        />
                        <label htmlFor="create_is_active" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                            Account is active immediately
                        </label>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => setIsCreateModalOpen(false)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createForm.processing}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                        >
                            {createForm.processing && <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />}
                            <span>Create Account</span>
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Edit User Modal */}
            <Modal
                isOpen={editingUser !== null}
                onClose={() => setEditingUser(null)}
                title={`Edit User: ${editingUser?.name}`}
                description="Update user credentials, role clearance, or active account status."
                maxWidth="md"
            >
                <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Full Name
                        </label>
                        <input
                            type="text"
                            required
                            value={editForm.data.name}
                            onChange={(e) => editForm.setData('name', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                        {editForm.errors.name && (
                            <p className="mt-1 text-xs text-rose-500">{editForm.errors.name}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Email Address
                        </label>
                        <input
                            type="email"
                            required
                            value={editForm.data.email}
                            onChange={(e) => editForm.setData('email', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                        {editForm.errors.email && (
                            <p className="mt-1 text-xs text-rose-500">{editForm.errors.email}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Reset Password (Leave blank to keep current)
                        </label>
                        <input
                            type="password"
                            value={editForm.data.password}
                            onChange={(e) => editForm.setData('password', e.target.value)}
                            placeholder="New password (optional)"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                        {editForm.errors.password && (
                            <p className="mt-1 text-xs text-rose-500">{editForm.errors.password}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Role Clearance
                        </label>
                        <Combobox
                            options={roleSelectionOptions}
                            value={editForm.data.role_id}
                            onChange={(val) => editForm.setData('role_id', val)}
                            placeholder="Select Role"
                            error={editForm.errors.role_id}
                            disabled={editingUser?.id === currentUserId}
                        />
                        {editingUser?.id === currentUserId && (
                            <p className="mt-1 text-[11px] text-slate-400">
                                You cannot change your own administrative role.
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                        <input
                            type="checkbox"
                            id="edit_is_active"
                            checked={editForm.data.is_active}
                            disabled={editingUser?.id === currentUserId}
                            onChange={(e) => editForm.setData('is_active', e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 disabled:opacity-50"
                        />
                        <label htmlFor="edit_is_active" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                            Account is active
                        </label>
                        {editingUser?.id === currentUserId && (
                            <span className="text-[11px] text-slate-400">(Self-deactivation disabled)</span>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => setEditingUser(null)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={editForm.processing}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                        >
                            {editForm.processing && <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />}
                            <span>Save Changes</span>
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Toggle Status Accessible Confirmation Modal (Zero Browser Alert/Confirm) */}
            <Modal
                isOpen={toggleUserTarget !== null}
                onClose={() => setToggleUserTarget(null)}
                title={
                    toggleUserTarget?.is_active
                        ? `Deactivate User: ${toggleUserTarget?.name}`
                        : `Activate User: ${toggleUserTarget?.name}`
                }
                description={
                    toggleUserTarget?.is_active
                        ? 'Deactivating this user will revoke their ability to sign in to any POS or WMS terminals immediately.'
                        : 'Activating this user will allow them to log in with their assigned role clearance immediately.'
                }
                confirmText={toggleUserTarget?.is_active ? 'Yes, Deactivate' : 'Yes, Activate'}
                isDestructive={toggleUserTarget?.is_active}
                onConfirm={handleConfirmToggleActive}
                maxWidth="sm"
            >
                <div className="text-xs text-slate-600 dark:text-slate-400">
                    Are you sure you want to update the account status for{' '}
                    <strong className="text-slate-900 dark:text-slate-100">{toggleUserTarget?.email}</strong>?
                </div>
            </Modal>
        </AppLayout>
    );
}
