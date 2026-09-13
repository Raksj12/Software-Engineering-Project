# BookHaven

BookHaven is a web-based e-commerce marketplace built to connect independent booksellers with readers. It gives small sellers a low-cost storefront while providing buyers with one place to search, compare, and purchase books from multiple sellers.

## Purpose and objective

Independent booksellers often lack resources to build custom e-commerce systems. BookHaven provides a shared platform where:
- Sellers can list and manage inventory without technical overhead.
- Buyers get a searchable catalog and a consistent checkout experience.
- Admin moderation ensures listing quality and policy compliance before publication.

## User roles

### Buyers
- Register and authenticate.
- Search and browse catalog.
- Purchase books.
- Request returns/refunds within policy windows.

### Sellers
- Register and authenticate.
- Create and manage listings with title, author, ISBN, genre, condition, description, cover image, price, and stock.

### Administrators
- Review submitted listings.
- Check policy compliance, including invalid ISBNs and prohibited content.
- Approve, reject, or request corrections before listings go live.

## Core functionality

1. **Account management**
   - Registration, authentication, and role-based access control for buyers, sellers, and admins.
2. **Listing creation and moderation**
   - Seller listing submission with ISBN format/checksum validation and prohibited-content screening.
   - Admin approval/rejection/change-request workflow.
3. **Search and discovery**
   - Search/filter by title, author, genre, and ISBN.
4. **Cart and checkout**
   - Add-to-cart, shipping details, payment method selection, and order placement through a third-party payment gateway.
5. **Order lifecycle and notifications**
   - Order confirmation and status notifications for buyers/sellers.
   - Listing moderation notifications.
6. **Returns and refunds**
   - Buyer return request in eligibility window.
   - Seller/admin review flow.
   - Approved returns refunded to the original payment method.

## Technical approach

BookHaven follows a three-tier architecture:

- **Front end**: Browser-based client for modern desktop/mobile browsers.
- **Back end**: Business logic for permissions, listing validation, inventory consistency, and order processing.
- **Database**: Relational storage for accounts, listings, orders, and returns.

### External integrations
- Third-party payment processor for transactions (BookHaven does not store raw payment card data, aligning with PCI-DSS practices).
- Optional email/notification service for status alerts.

## Concurrency and consistency

The platform must support concurrent access safely, including preventing overselling when multiple buyers attempt to purchase the last in-stock copy simultaneously.

## Current scope

The initial release includes:
- Account management
- Listing creation/moderation
- Search and checkout
- Returns/refunds

Out of scope for this phase:
- Internal implementation of the payment gateway
- Production hosting/deployment infrastructure
- Native mobile applications

## Team — Group [2]
- Cindy Cardona-Felix
- Rakshit Jaiswal
- Jalil Jimenez
- Everett Wappler

## Getting Started (Local Development)
```bash
git clone https://github.com/Raksj12/Software-Engineering-Project.git
cd Software-Engineering-Project
npm install
npm start
```


## use this for commit style
   git commit -m "Short summary" -m "Longer explanation of what and why. Closes #N."
