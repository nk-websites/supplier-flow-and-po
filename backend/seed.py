"""Seed data for NewKommerce — mirrors the original mock dataset."""

SUPPLIERS = [
    {
        "id": "sup-001", "code": "SUP-001", "name": "Fresh Farms Co.",
        "status": "Active", "categories": ["Vegetables"],
        "contact_person": "Ravi Kumar", "phone": "+91 98765 43210",
        "email": "ravi@freshfarms.co", "role": "Owner",
        "address": "18 Residency Road", "city": "Bangalore", "state": "Karnataka",
        "country": "India", "pincode": "560025", "gst": "29ABCDE1234F1Z5",
        "payment_terms": "Net 15",
        "contacts": [
            {"name": "Ravi Kumar", "phone": "+91 98765 43210", "email": "ravi@freshfarms.co", "role": "Owner"},
            {"name": "Divya Menon", "phone": "+91 98450 11223", "email": "divya@freshfarms.co", "role": "Accounts"},
        ],
    },
    {
        "id": "sup-002", "code": "SUP-002", "name": "Dairy Direct",
        "status": "Active", "categories": ["Dairy"],
        "contact_person": "Anita Sharma", "phone": "+91 91234 56789",
        "email": "anita@dairydirect.in", "role": "Sales Manager",
        "address": "42 Milk Colony", "city": "Pune", "state": "Maharashtra",
        "country": "India", "pincode": "411001", "gst": "27FGHIJ5678K2Z9",
        "payment_terms": "Net 30",
        "contacts": [
            {"name": "Anita Sharma", "phone": "+91 91234 56789", "email": "anita@dairydirect.in", "role": "Sales Manager"},
        ],
    },
    {
        "id": "sup-003", "code": "SUP-003", "name": "Spice World Traders",
        "status": "Active", "categories": ["Spices", "Grains"],
        "contact_person": "Mohammed Iqbal", "phone": "+91 90000 11223",
        "email": "iqbal@spiceworld.in", "role": "Proprietor",
        "address": "7 Spice Market", "city": "Kochi", "state": "Kerala",
        "country": "India", "pincode": "682001", "gst": "32LMNOP9012Q3Z1",
        "payment_terms": "Net 30",
        "contacts": [
            {"name": "Mohammed Iqbal", "phone": "+91 90000 11223", "email": "iqbal@spiceworld.in", "role": "Proprietor"},
        ],
    },
    {
        "id": "sup-004", "code": "SUP-004", "name": "Metro Wholesale",
        "status": "Active", "categories": ["Meat", "Vegetables", "Dairy"],
        "contact_person": "Joseph D'Souza", "phone": "+91 99887 76655",
        "email": "joseph@metrowholesale.in", "role": "Key Account Manager",
        "address": "301 Market Yard", "city": "Mumbai", "state": "Maharashtra",
        "country": "India", "pincode": "400010", "gst": "27RSTUV3456W4Z7",
        "payment_terms": "Net 15",
        "contacts": [
            {"name": "Joseph D'Souza", "phone": "+91 99887 76655", "email": "joseph@metrowholesale.in", "role": "Key Account Manager"},
            {"name": "Farah Khan", "phone": "+91 98200 33445", "email": "farah@metrowholesale.in", "role": "Dispatch"},
        ],
    },
    {
        "id": "sup-005", "code": "SUP-005", "name": "PackRight Supplies",
        "status": "Pending Verification", "categories": ["Packaging"],
        "contact_person": "", "phone": "", "email": "", "role": "",
        "address": "9 Industrial Estate", "city": "Ahmedabad", "state": "Gujarat",
        "country": "India", "pincode": "380015", "gst": "",
        "payment_terms": "COD", "contacts": [],
    },
    {
        "id": "sup-006", "code": "SUP-006", "name": "Green Leaf Organics",
        "status": "Inactive", "categories": ["Vegetables", "Dairy"],
        "contact_person": "Sunita Rao", "phone": "+91 98111 22334",
        "email": "sunita@greenleaf.in", "role": "Director",
        "address": "12 Farm Road", "city": "Nashik", "state": "Maharashtra",
        "country": "India", "pincode": "422001", "gst": "27WXYZ6789A5Z3",
        "payment_terms": "Net 7",
        "contacts": [
            {"name": "Sunita Rao", "phone": "+91 98111 22334", "email": "sunita@greenleaf.in", "role": "Director"},
        ],
    },
]

# cost_type is "Last Purchase Price" or "Average Cost"
PRODUCTS = [
    {"id": "prod-001", "code": "RM-001", "name": "Tomatoes", "sku": "VEG-TOM", "category": "Vegetables",
     "unit": "kg", "current": 8, "threshold": 10, "cost": 42, "cost_type": "Last Purchase Price",
     "preferred_supplier_id": "sup-001"},
    {"id": "prod-002", "code": "RM-002", "name": "Onions", "sku": "VEG-ONI", "category": "Vegetables",
     "unit": "kg", "current": 55, "threshold": 20, "cost": 29.2, "cost_type": "Average Cost",
     "preferred_supplier_id": "sup-001"},
    {"id": "prod-003", "code": "RM-003", "name": "Paneer", "sku": "DAI-PNR", "category": "Dairy",
     "unit": "kg", "current": 2, "threshold": 5, "cost": 380, "cost_type": "Last Purchase Price",
     "preferred_supplier_id": "sup-002"},
    {"id": "prod-004", "code": "RM-004", "name": "Milk", "sku": "DAI-MLK", "category": "Dairy",
     "unit": "litre", "current": 40, "threshold": 20, "cost": 60.4, "cost_type": "Average Cost",
     "preferred_supplier_id": "sup-002"},
    {"id": "prod-005", "code": "RM-005", "name": "Basmati Rice", "sku": "GRN-BAS", "category": "Grains",
     "unit": "kg", "current": 40, "threshold": 20, "cost": 108, "cost_type": "Average Cost",
     "preferred_supplier_id": "sup-003"},
    {"id": "prod-006", "code": "RM-006", "name": "Garam Masala", "sku": "SPC-GRM", "category": "Spices",
     "unit": "kg", "current": 0, "threshold": 2, "cost": 620, "cost_type": "Last Purchase Price",
     "preferred_supplier_id": "sup-003"},
    {"id": "prod-007", "code": "RM-007", "name": "Butter", "sku": "DAI-BTR", "category": "Dairy",
     "unit": "kg", "current": 5, "threshold": 10, "cost": 420, "cost_type": "Last Purchase Price",
     "preferred_supplier_id": "sup-001"},
    {"id": "prod-008", "code": "RM-008", "name": "Takeaway Boxes (Medium)", "sku": "PKG-BOX-M", "category": "Packaging",
     "unit": "piece", "current": 480, "threshold": 200, "cost": 6, "cost_type": "Last Purchase Price",
     "preferred_supplier_id": "sup-005"},
]

# priority in P0/P1/P2
SUPPLIER_PRODUCTS = [
    {"supplier_id": "sup-001", "product_id": "prod-001", "price": 42, "unit": "kg", "priority": "P0", "moq": 20, "last_purchased": "2026-07-28"},
    {"supplier_id": "sup-001", "product_id": "prod-002", "price": 28, "unit": "kg", "priority": "P0", "moq": 25, "last_purchased": "2026-07-20"},
    {"supplier_id": "sup-001", "product_id": "prod-007", "price": 420, "unit": "kg", "priority": "P0", "moq": 20, "last_purchased": "2026-07-25"},
    {"supplier_id": "sup-002", "product_id": "prod-003", "price": 380, "unit": "kg", "priority": "P0", "moq": 5, "last_purchased": "2026-07-31"},
    {"supplier_id": "sup-002", "product_id": "prod-004", "price": 60.4, "unit": "litre", "priority": "P0", "moq": 20, "last_purchased": "2026-08-01"},
    {"supplier_id": "sup-003", "product_id": "prod-005", "price": 108, "unit": "kg", "priority": "P1", "moq": 10, "last_purchased": "2026-07-30"},
    {"supplier_id": "sup-003", "product_id": "prod-006", "price": 620, "unit": "kg", "priority": "P0", "moq": 2, "last_purchased": "2026-07-29"},
    {"supplier_id": "sup-004", "product_id": "prod-001", "price": 42, "unit": "kg", "priority": "P1", "moq": 50, "last_purchased": "2026-07-30"},
    {"supplier_id": "sup-004", "product_id": "prod-003", "price": 380, "unit": "kg", "priority": "P1", "moq": 10, "last_purchased": "2026-07-18"},
    {"supplier_id": "sup-004", "product_id": "prod-007", "price": 420, "unit": "kg", "priority": "P1", "moq": 10, "last_purchased": "2026-07-18"},
    {"supplier_id": "sup-005", "product_id": "prod-008", "price": 6, "unit": "piece", "priority": "P0", "moq": 500, "last_purchased": "2026-07-28"},
    {"supplier_id": "sup-006", "product_id": "prod-001", "price": 40, "unit": "kg", "priority": "P2", "moq": 25, "last_purchased": "2026-06-12"},
    {"supplier_id": "sup-006", "product_id": "prod-004", "price": 58, "unit": "litre", "priority": "P2", "moq": 20, "last_purchased": "2026-06-12"},
]

TRANSACTIONS = [
    {"date": "2026-08-01", "product_id": "prod-002", "qty": -2, "unit": "kg", "type": "Waste", "reason": "Spoilage", "created_by": "Aarav Mehta", "related_po": ""},
    {"date": "2026-08-01", "product_id": "prod-007", "qty": 5, "unit": "kg", "type": "Manual Adjustment", "reason": "Stock Count Correction", "created_by": "Priya Nair", "related_po": ""},
    {"date": "2026-08-01", "product_id": "prod-004", "qty": -3, "unit": "litre", "type": "Expired", "reason": "Expired", "created_by": "Aarav Mehta", "related_po": ""},
    {"date": "2026-07-31", "product_id": "prod-001", "qty": -1, "unit": "kg", "type": "Damaged", "reason": "Damaged During Delivery", "created_by": "Rahul Sharma", "related_po": ""},
    {"date": "2026-07-31", "product_id": "prod-003", "qty": -0.5, "unit": "kg", "type": "Expired", "reason": "Expired", "created_by": "Priya Nair", "related_po": ""},
    {"date": "2026-07-30", "product_id": "prod-005", "qty": -2, "unit": "kg", "type": "Manual Adjustment", "reason": "Previous Entry Mistake", "created_by": "Aarav Mehta", "related_po": ""},
    {"date": "2026-07-29", "product_id": "prod-006", "qty": -1, "unit": "kg", "type": "Waste", "reason": "Kitchen Waste", "created_by": "Rahul Sharma", "related_po": ""},
    {"date": "2026-07-28", "product_id": "prod-008", "qty": -20, "unit": "piece", "type": "Damaged", "reason": "Water Damage", "created_by": "Priya Nair", "related_po": ""},
]

# items reference product_id/qty/unit/unit_price; line_total computed on load.
PURCHASE_ORDERS = [
    {"reference": "DRAFT-004", "supplier_id": "sup-004", "status": "Draft", "activity_date": "2026-07-30",
     "items": [{"product_id": "prod-001", "qty": 76.25, "unit": "kg", "unit_price": 42}]},
    {"reference": "DRAFT-006", "supplier_id": "sup-002", "status": "Draft", "activity_date": "2026-07-29",
     "items": [{"product_id": "prod-007", "qty": 2.9, "unit": "kg", "unit_price": 420}]},
    {"reference": "DRAFT-007", "supplier_id": "sup-002", "status": "Draft", "activity_date": "2026-10-08",
     "items": [{"product_id": "prod-007", "qty": 9, "unit": "kg", "unit_price": 420}]},
    {"reference": "DRAFT-008", "supplier_id": "sup-002", "status": "Draft", "activity_date": "2026-10-08",
     "items": [{"product_id": "prod-007", "qty": 4.5, "unit": "kg", "unit_price": 420}]},
    {"reference": "DRAFT-009", "supplier_id": "sup-002", "status": "Draft", "activity_date": "2026-10-08",
     "items": [{"product_id": "prod-007", "qty": 4.35, "unit": "kg", "unit_price": 420}]},
    {"reference": "DRAFT-010", "supplier_id": "sup-004", "status": "Draft", "activity_date": "2026-10-08",
     "items": [{"product_id": "prod-001", "qty": 91.5, "unit": "kg", "unit_price": 42}]},
    {"reference": "DRAFT-011", "supplier_id": "sup-004", "status": "Draft", "activity_date": "2026-10-08",
     "items": [{"product_id": "prod-001", "qty": 106.75, "unit": "kg", "unit_price": 42}]},
    {"reference": "PO-2026-001", "supplier_id": "sup-001", "status": "Sent", "activity_date": "2026-07-25",
     "items": [
         {"product_id": "prod-007", "qty": 2, "unit": "kg", "unit_price": 420},
         {"product_id": "prod-001", "qty": 20, "unit": "kg", "unit_price": 42},
     ]},
    {"reference": "PO-2026-002", "supplier_id": "sup-003", "status": "Sent", "activity_date": "2026-07-20",
     "items": [{"product_id": "prod-005", "qty": 50, "unit": "kg", "unit_price": 108}]},
    {"reference": "PO-2026-003", "supplier_id": "sup-004", "status": "Sent", "activity_date": "2026-07-18",
     "items": [{"product_id": "prod-003", "qty": 10, "unit": "kg", "unit_price": 380}]},
    {"reference": "PO-2026-004", "supplier_id": "sup-002", "status": "Cancelled", "activity_date": "2026-07-15",
     "items": [{"product_id": "prod-004", "qty": 30, "unit": "litre", "unit_price": 60.4}]},
]

CATEGORIES = ["Vegetables", "Dairy", "Meat", "Grains", "Spices", "Packaging", "Other"]
COUNTRIES = ["India", "United Arab Emirates", "Singapore", "United Kingdom", "United States"]
PAYMENT_TERMS = ["Net 7", "Net 15", "Net 30", "COD"]
PRIORITIES = ["P0", "P1", "P2"]
TRANSACTION_TYPES = ["Waste", "Expired", "Damaged", "Manual Adjustment", "Purchase Receipt", "Return"]
