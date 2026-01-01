# Business Logic Patterns

> **Purpose**: Document domain-specific business rules and workflows
> **Where to use**: Reference from docs/architecture.md or .claude/rules/domain-patterns.md

## Core Business Rules

**[FILL IN: What are the fundamental business rules?]**

Example prompts:
- What are the invariants that must always be true?
- What business processes are implemented?
- What are the validation rules?
- What constraints exist in the domain?

Example:
```
- User must be authenticated to place an order
- Cart must contain at least 1 item
- Order total must be > $0
- Payment must be authorized before order is confirmed
```

## Key Workflows

### Workflow 1: [NAME]

**[FILL IN: Describe a critical business workflow]**

Prompts:
- What triggers this workflow?
- What are the steps?
- What can go wrong?
- How are errors handled?
- What are the success/failure conditions?

Example:
```
Workflow: User Registration
Trigger: User clicks "Sign Up"
Steps:
1. Validate email format
2. Check if email already exists
3. Hash password
4. Create user record
5. Send verification email
6. Redirect to verification page

Error handling:
- Email exists → Show "Email already registered"
- Invalid email → Show validation error
- Email send fails → Log error, show retry option
```

### Workflow 2: [NAME]

**[FILL IN: Another important workflow]**

### Workflow 3: [NAME]

**[FILL IN: Add as many workflows as needed]**

## Domain Models

**[FILL IN: Key entities and their relationships]**

Prompts:
- What are the main entities?
- How do they relate to each other?
- What are the lifecycle states?
- What are the business constraints?

Example:
```
User
- has many Orders
- has one Cart
- has one Profile
- States: pending_verification → active → suspended → deleted

Order
- belongs to User
- has many OrderItems
- has one Payment
- States: pending → processing → confirmed → shipped → delivered → cancelled

Cart
- belongs to User
- has many CartItems
- expires after 30 days
```

## Edge Cases & Exceptions

**[FILL IN: Known edge cases and how they're handled]**

Prompts:
- What unusual scenarios exist?
- How are they handled?
- What are the business exceptions?
- What requires manual intervention?

Example:
```
Edge Case: User tries to order out-of-stock item
- If last item in cart → Allow order, notify user of backorder
- If multiple items → Remove out-of-stock, proceed with available items
- If all items out-of-stock → Cancel order, notify user

Edge Case: Payment authorized but order fails to create
- Void payment authorization
- Log incident for investigation
- Notify user of failure
- Retry logic: 3 attempts with exponential backoff
```

## Decision Trees

**[FILL IN: Key decision points in the business logic]**

Example:
```
Discount Calculation:
If user is premium:
  → Apply premium discount (20%)
  → Free shipping
Else if order total > $100:
  → Apply bulk discount (10%)
  → Standard shipping rate
Else if user has promo code:
  → Apply promo code discount
  → Standard shipping rate
Else:
  → No discount
  → Standard shipping rate
```

## Business Calculations

**[FILL IN: Important calculations with formulas]**

Example prompts:
- How is pricing calculated?
- How are fees determined?
- How are discounts applied?
- What are the tax rules?

Example:
```
Order Total Calculation:
1. Subtotal = Sum of (item.price × item.quantity) for all items
2. Discount = Apply discount logic (see Decision Trees)
3. Shipping = Calculate based on weight and destination
4. Tax = Subtotal × tax_rate (varies by region)
5. Total = Subtotal - Discount + Shipping + Tax
```

## State Transitions

**[FILL IN: Valid state transitions and triggers]**

Example:
```
Order State Machine:

pending → processing
  Trigger: Payment authorized
  Effect: Lock inventory, send to fulfillment

processing → confirmed
  Trigger: Inventory allocated
  Effect: Notify user, create shipping label

confirmed → shipped
  Trigger: Package handed to carrier
  Effect: Send tracking info to user

shipped → delivered
  Trigger: Carrier confirms delivery
  Effect: Close order, request review

Any state → cancelled
  Trigger: User cancellation or payment failure
  Effect: Release inventory, refund if needed
```

## Business Constraints

**[FILL IN: Hard constraints that must never be violated]**

Example:
```
Invariants:
- Cart.total must always equal sum of CartItem.price × CartItem.quantity
- User cannot have more than one active Cart
- Order.total must match Payment.amount
- Inventory.available_quantity cannot be negative
- User.email must be unique
```

## Common Business Scenarios

**[FILL IN: Typical use cases and how they're handled]**

Example:
```
Scenario: User updates cart quantity
1. Validate new quantity (min: 1, max: inventory.available)
2. Update CartItem.quantity
3. Recalculate Cart.total
4. Update UI with new total
5. If quantity exceeds inventory → Show warning, set to max available

Scenario: User applies promo code
1. Validate promo code (exists, not expired, not already used by user)
2. Check eligibility (minimum order total, specific items, user tier)
3. Calculate discount
4. Apply to order
5. Store promo code usage to prevent reuse
```

---

## After Filling This Out

1. **Rename file**: `docs/TEMPLATE-business-logic.md` → `docs/business-logic.md`

2. **Reference from**:
   - `docs/architecture.md` - Link to this file for business logic details
   - `.claude/rules/domain-patterns.md` - (create if needed) Point to this file for domain patterns
   - `CLAUDE.md` - List in "Deep Dive Documentation" section

3. **Keep updated**: Review this file when business requirements change or new features are added
