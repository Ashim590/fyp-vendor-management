import React, { useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  createPurchaseRequest,
  getPurchaseRequestById,
  updatePurchaseRequest,
  submitForApproval,
} from "@/redux/purchaseRequestSlice";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "sonner";
import { useNavigate, Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
const PurchaseRequests = () => {
  const { id: editId } = useParams();
  const isEditMode = Boolean(editId);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { currentPurchaseRequest } = useSelector((store) => store.purchaseRequest);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    department: "",
    deliveryLocation: "",
    requiredDate: "",
    justification: "",
    priority: "medium",
    notes: "",
  });

  const [items, setItems] = useState([
    {
      itemName: "",
      description: "",
      quantity: 1,
      unit: "pieces",
      estimatedUnitPrice: 0,
      specifications: "",
      category: "other",
    },
  ]);

  React.useEffect(() => {
    if (editId) {
      dispatch(getPurchaseRequestById(editId));
    }
  }, [dispatch, editId]);

  React.useEffect(() => {
    if (!editId || !currentPurchaseRequest) return;
    if (String(currentPurchaseRequest._id) !== String(editId)) return;
    setFormData({
      title: currentPurchaseRequest.title || "",
      description: currentPurchaseRequest.description || "",
      department: currentPurchaseRequest.department || "",
      deliveryLocation: currentPurchaseRequest.deliveryLocation || "",
      requiredDate: currentPurchaseRequest.requiredDate
        ? new Date(currentPurchaseRequest.requiredDate).toISOString().slice(0, 10)
        : "",
      justification: currentPurchaseRequest.justification || "",
      priority: currentPurchaseRequest.priority || "medium",
      notes: currentPurchaseRequest.notes || "",
    });
    const mappedItems = Array.isArray(currentPurchaseRequest.items)
      ? currentPurchaseRequest.items.map((it) => ({
          itemName: it.itemName || "",
          description: it.description || "",
          quantity: Number(it.quantity || 1),
          unit: it.unit || "pieces",
          estimatedUnitPrice: Number(it.estimatedUnitPrice || 0),
          specifications: it.specifications || "",
          category: it.category || "other",
        }))
      : [];
    if (mappedItems.length) setItems(mappedItems);
  }, [editId, currentPurchaseRequest]);

  // ---------- Handlers ----------

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    setItems((prevItems) => {
      const newItems = [...prevItems];
      if (field === "quantity") value = parseInt(value, 10) || 0;
      if (field === "estimatedUnitPrice") {
        const s = String(value).trim();
        if (s === "" || s === ".") {
          value = 0;
        } else {
          let t = s.replace(",", "");
          // Strip leading zeros so "05" / "050" become "5" / "50"; keep "0.5", "0.05"
          if (/^0+\d/.test(t) && !/^\./.test(t)) {
            t = t.replace(/^0+/, "") || "0";
          }
          const n = parseFloat(t);
          value = Number.isFinite(n) ? n : newItems[index][field];
        }
      }
      newItems[index][field] = value;
      return newItems;
    });
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        itemName: "",
        description: "",
        quantity: 1,
        unit: "pieces",
        estimatedUnitPrice: 0,
        specifications: "",
        category: "other",
      },
    ]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const calculateTotal = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + item.quantity * item.estimatedUnitPrice,
      0
    );
  }, [items]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-NP", {
      style: "currency",
      currency: "NPR",
    }).format(amount || 0);
  };

  const handleSubmit = async (e, status) => {
    e.preventDefault();

    // Required form fields
    if (
      !formData.title ||
      !formData.description ||
      !formData.department ||
      !formData.deliveryLocation ||
      !formData.requiredDate
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    // At least one valid item
    const validItems = items.filter(
      (item) => item.itemName && item.quantity > 0
    );
    if (validItems.length === 0) {
      toast.error("Please add at least one valid item");
      return;
    }

    setLoading(true);
    try {
      // Always create PR first, then call submit endpoint so approval + notifications run.
      const payload = {
        ...formData,
        items: validItems,
        status: status === "draft" ? "draft" : "draft",
      };
      if (isEditMode && editId) {
        await dispatch(
          updatePurchaseRequest({ requestId: editId, formData: payload })
        ).unwrap();
        if (status === "pending_approval") {
          await dispatch(submitForApproval(editId)).unwrap();
        }
      } else {
        const created = await dispatch(createPurchaseRequest(payload)).unwrap();
        const createdId = created?.purchaseRequest?._id;
        if (status === "pending_approval" && createdId) {
          await dispatch(submitForApproval(createdId)).unwrap();
        }
      }
      toast.success(
        `Purchase request ${
          status === "draft" ? "saved as draft" : "submitted"
        } successfully`
      );
      navigate("/purchase-requests");
    } catch (err) {
      toast.error(err || "Failed to create purchase request");
    } finally {
      setLoading(false);
    }
  };

  // ---------- Render ----------

  return (
    <div className="w-full flex-1 bg-canvas py-5 sm:py-6">
      <div className="max-w-7xl mx-auto px-4">
        <div className="rounded-3xl border border-[#dbe7f7] bg-surface p-4 shadow-[0_12px_36px_rgba(11,31,77,0.08)] sm:p-5 lg:p-6">
        <div className="mb-6">
          <Link
            to="/purchase-requests"
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Purchase Requests
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6">
            {isEditMode ? "Edit Purchase Request" : "Create Purchase Request"}
          </h1>

          <form onSubmit={(e) => handleSubmit(e, "pending_approval")}>
            {/* ----- Form Fields ----- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <Label>Title *</Label>
                <Input
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Enter request title"
                  required
                />
              </div>

              <div>
                <Label>Department *</Label>
                <Input
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  placeholder="e.g., IT, Admin, Finance"
                  required
                />
              </div>

              <div>
                <Label>Delivery Location *</Label>
                <Input
                  name="deliveryLocation"
                  value={formData.deliveryLocation}
                  onChange={handleInputChange}
                  placeholder="Enter delivery address"
                  required
                />
              </div>

              <div>
                <Label>Required Date *</Label>
                <Input
                  type="date"
                  name="requiredDate"
                  value={formData.requiredDate}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div>
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, priority: v }))
                  }
                >
                  <SelectTrigger className="w-full border-slate-200 bg-white">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mb-6">
              <Label>Description *</Label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe what you need to purchase"
                className="w-full border rounded-md px-3 py-2"
                rows={3}
                required
              />
            </div>

            <div className="mb-6">
              <Label>Justification</Label>
              <textarea
                name="justification"
                value={formData.justification}
                onChange={handleInputChange}
                placeholder="Why is this purchase necessary?"
                className="w-full border rounded-md px-3 py-2"
                rows={2}
              />
            </div>

            {/* ----- Items ----- */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Items</h2>
                <Button type="button" variant="outline" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-2" /> Add Item
                </Button>
              </div>

              {items.map((item, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 mb-4 bg-gray-50"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="font-medium">Item #{index + 1}</span>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <Label>Item Name *</Label>
                      <Input
                        value={item.itemName}
                        onChange={(e) =>
                          handleItemChange(index, "itemName", e.target.value)
                        }
                        placeholder="Item name"
                        required
                      />
                    </div>

                    <div>
                      <Label>Quantity *</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="1"
                        className="tabular-nums"
                        value={item.quantity === 0 ? "" : String(item.quantity)}
                        onChange={(e) =>
                          handleItemChange(index, "quantity", e.target.value)
                        }
                        required
                      />
                    </div>

                    <div>
                      <Label>Unit</Label>
                      <Select
                        value={item.unit}
                        onValueChange={(v) =>
                          handleItemChange(index, "unit", v)
                        }
                      >
                        <SelectTrigger className="w-full border-slate-200 bg-white">
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pieces">Pieces</SelectItem>
                          <SelectItem value="kg">Kg</SelectItem>
                          <SelectItem value="liters">Liters</SelectItem>
                          <SelectItem value="boxes">Boxes</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Est. Unit Price</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0"
                        className="tabular-nums"
                        value={
                          item.estimatedUnitPrice === 0
                            ? ""
                            : String(item.estimatedUnitPrice)
                        }
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            "estimatedUnitPrice",
                            e.target.value
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div>
                      <Label>Category</Label>
                      <Select
                        value={item.category}
                        onValueChange={(v) =>
                          handleItemChange(index, "category", v)
                        }
                      >
                        <SelectTrigger className="w-full border-slate-200 bg-white">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="office">Office</SelectItem>
                          <SelectItem value="it">IT</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="text-right font-medium flex items-center justify-end">
                      Subtotal:{" "}
                      {formatCurrency(item.quantity * item.estimatedUnitPrice)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ----- Total ----- */}
            <div className="border-t pt-4 mb-6">
              <div className="text-right">
                <span className="text-lg font-semibold">
                  Total Estimated Amount:{" "}
                </span>
                <span className="text-2xl font-bold">
                  {formatCurrency(calculateTotal)}
                </span>
              </div>
            </div>

            {/* ----- Action Buttons ----- */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={(e) => handleSubmit(e, "draft")}
                disabled={loading}
              >
                <Save className="h-4 w-4 mr-2" /> Save as Draft
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Submitting..." : "Submit for Approval"}
              </Button>
            </div>
          </form>
        </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseRequests;
