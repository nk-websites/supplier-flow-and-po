import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { SuppliersPage } from "@/pages/SuppliersPage";
import { SupplierNewPage } from "@/pages/SupplierNewPage";
import { SupplierDetailPage } from "@/pages/SupplierDetailPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { ProductNewPage } from "@/pages/ProductNewPage";
import { ProductDetailPage } from "@/pages/ProductDetailPage";
import { TransactionsPage } from "@/pages/TransactionsPage";
import { PurchaseOrdersPage } from "@/pages/PurchaseOrdersPage";
import { PurchaseOrderNewPage } from "@/pages/PurchaseOrderNewPage";
import { PurchaseRequestsPage } from "@/pages/PurchaseRequestsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/suppliers/new" element={<SupplierNewPage />} />
        <Route path="/suppliers/:id" element={<SupplierDetailPage />} />
        <Route path="/inventory/products" element={<ProductsPage />} />
        <Route path="/inventory/raw-materials/new" element={<ProductNewPage />} />
        <Route path="/inventory/raw-materials/:id" element={<ProductDetailPage />} />
        <Route path="/inventory/transactions" element={<TransactionsPage />} />
        <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="/purchase-orders/new" element={<PurchaseOrderNewPage />} />
        <Route path="/purchase-requests" element={<PurchaseRequestsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
