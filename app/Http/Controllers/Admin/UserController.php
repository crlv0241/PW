<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

final class UserController extends Controller
{
    /**
     * Display a listing of system users with roles and filters.
     */
    public function index(Request $request): Response
    {
        Gate::authorize('access-admin');

        $search = $request->string('search')->trim()->value();
        $roleFilter = $request->string('role')->trim()->value();

        $users = User::query()
            ->with('roles')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->when($roleFilter !== '', function ($query) use ($roleFilter) {
                $query->whereHas('roles', function ($q) use ($roleFilter) {
                    $q->where('name', $roleFilter);
                });
            })
            ->latest('id')
            ->paginate(10)
            ->withQueryString()
            ->through(function (User $user) {
                $role = $user->roles->first();

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'is_active' => (bool) $user->is_active,
                    'created_at' => $user->created_at?->format('Y-m-d H:i') ?? 'N/A',
                    'primary_role' => $user->primaryRoleName(),
                    'role_id' => $role?->id,
                    'role_name' => $role instanceof Role ? $role->name : 'none',
                    'is_super_admin' => $user->isSuperAdmin(),
                ];
            });

        $roles = Role::query()
            ->orderBy('id')
            ->get(['id', 'name', 'display_name', 'description'])
            ->map(fn (Role $r) => [
                'id' => $r->id,
                'name' => $r->name,
                'display_name' => $r->display_name,
                'description' => $r->description,
            ]);

        return Inertia::render('admin/users/index', [
            'users' => $users,
            'roles' => $roles,
            'filters' => [
                'search' => $search,
                'role' => $roleFilter,
            ],
        ]);
    }

    /**
     * Store a newly created user in storage.
     */
    public function store(StoreUserRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'is_active' => (bool) ($validated['is_active'] ?? true),
        ]);

        $user->roles()->sync([(int) $validated['role_id']]);

        return redirect()->route('admin.users.index')
            ->with('success', "User '{$user->name}' created successfully.");
    }

    /**
     * Update the specified user in storage.
     */
    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $validated = $request->validated();
        $currentUser = $request->user();

        // Guard against self-lockout
        if ($currentUser !== null && $user->id === $currentUser->id) {
            if (isset($validated['is_active']) && ! $validated['is_active']) {
                return redirect()->back()->with('error', 'You cannot deactivate your own administrative account.');
            }

            $superAdminRole = Role::where('name', 'super_admin')->first();
            if ($superAdminRole !== null && (int) $validated['role_id'] !== $superAdminRole->id) {
                return redirect()->back()->with('error', 'You cannot revoke the Super Administrator role from yourself.');
            }
        }

        $userData = [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'is_active' => (bool) ($validated['is_active'] ?? $user->is_active),
        ];

        if (! empty($validated['password'])) {
            $userData['password'] = Hash::make($validated['password']);
        }

        $user->update($userData);
        $user->roles()->sync([(int) $validated['role_id']]);

        return redirect()->route('admin.users.index')
            ->with('success', "User '{$user->name}' updated successfully.");
    }

    /**
     * Toggle the active status of a user.
     */
    public function toggleActive(Request $request, User $user): RedirectResponse
    {
        Gate::authorize('access-admin');

        $currentUser = $request->user();
        if ($currentUser !== null && $user->id === $currentUser->id) {
            return redirect()->back()->with('error', 'You cannot deactivate your own administrative account.');
        }

        $user->is_active = ! $user->is_active;
        $user->save();

        $status = $user->is_active ? 'activated' : 'deactivated';

        return redirect()->route('admin.users.index')
            ->with('success', "User '{$user->name}' has been {$status}.");
    }
}
