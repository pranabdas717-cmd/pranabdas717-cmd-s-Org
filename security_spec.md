# Security Specification - Sales Management App

## Data Invariants
1. A user cannot mark attendance for another user.
2. A sales representative can only view and create orders/outlets they are responsible for.
3. A supervisor can view and manage data (orders, attendance, targets) for sales representatives assigned to them.
4. Admins have full access to all data.
5. Attendance status transitions must be authorized: sales reps can submit 'pending', supervisors/admins can move to 'confirmed' or 'rejected'.
6. Orders start as 'pending' and can be moved to 'approved', 'confirmed', 'delivered', or 'cancelled' by authorized roles.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing (Attendance):** Sales rep A tries to mark attendance for Sales rep B.
2. **Privilege Escalation (User Role):** Sales rep tries to change their own role to 'admin'.
3. **Identity Spoofing (Order):** Sales rep A tries to create an order as Sales rep B.
4. **Unauthorized Read (Order):** Sales rep A tries to read Sales rep B's orders.
5. **Unauthorized Approval (Attendance):** Sales rep tries to confirm their own attendance.
6. **State Shortcutting (Order):** Sales rep tries to move an order directly to 'delivered' from 'pending'.
7. **Resource Poisoning (ID):** Injecting 1MB string as a document ID.
8. **PII Leak:** An unauthenticated user tries to read the `users` collection.
9. **Relational Skip:** Creating an order without a valid `salesRepId`.
10. **Admin Area Access:** Sales rep tries to read the `territories` collection.
11. **Negative Target:** Setting a monthly target to -1000.
12. **Future Timestamp:** Setting `timestamp` to a future date instead of `serverTimestamp()`.

## Test Cases (High Level)
- `users/{userId}`: `get` allowed if self or admin. `list` allowed for admin. `update` restricted.
- `attendance/{id}`: `create` allowed for self. `read` allowed for self, supervisor, admin. `update` allowed for supervisor/admin.
- `orders/{id}`: `create` allowed for self. `read` allowed for self, supervisor, admin. `update` allowed for self (if pending), supervisor, admin.
- `territories/{id}`: `read` allowed for members, supervisor, admin. `write` allowed for admin.
