import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { PURCHASE_ORDER_API_END_POINT } from "@/utils/constant";

export const createPurchaseOrder = createAsyncThunk(
  "purchaseOrder/create",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `${PURCHASE_ORDER_API_END_POINT}/create`,
        formData,
        {
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, "Error creating purchase order")
      );
    }
  }
);

export const getAllPurchaseOrders = createAsyncThunk(
  "purchaseOrder/getAll",
  async (filters = {}, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${PURCHASE_ORDER_API_END_POINT}`, {
        params: filters,
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, "Error fetching purchase orders")
      );
    }
  }
);

export const getPurchaseOrderById = createAsyncThunk(
  "purchaseOrder/getById",
  async (orderId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${PURCHASE_ORDER_API_END_POINT}/${orderId}`,
        {
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, "Error fetching purchase order")
      );
    }
  }
);

export const updatePurchaseOrder = createAsyncThunk(
  "purchaseOrder/update",
  async ({ orderId, formData }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${PURCHASE_ORDER_API_END_POINT}/${orderId}`,
        formData,
        {
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, "Error updating purchase order")
      );
    }
  }
);

const purchaseOrderSlice = createSlice({
  name: "purchaseOrder",
  initialState: {
    purchaseOrders: [],
    currentPurchaseOrder: null,
    loading: false,
    error: null,
    success: false,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSuccess: (state) => {
      state.success = false;
    },
    resetPurchaseOrderState: (state) => {
      state.purchaseOrders = [];
      state.currentPurchaseOrder = null;
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createPurchaseOrder.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createPurchaseOrder.fulfilled, (state, action) => {
        state.loading = false;
        state.currentPurchaseOrder = action.payload.purchaseOrder;
        state.success = true;
      })
      .addCase(createPurchaseOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getAllPurchaseOrders.pending, (state) => {
        state.loading = true;
      })
      .addCase(getAllPurchaseOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.purchaseOrders = action.payload.purchaseOrders;
      })
      .addCase(getAllPurchaseOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getPurchaseOrderById.pending, (state) => {
        state.loading = true;
      })
      .addCase(getPurchaseOrderById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentPurchaseOrder = action.payload.purchaseOrder;
      })
      .addCase(getPurchaseOrderById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updatePurchaseOrder.pending, (state) => {
        state.loading = true;
      })
      .addCase(updatePurchaseOrder.fulfilled, (state, action) => {
        state.loading = false;
        state.currentPurchaseOrder = action.payload.purchaseOrder;
        state.success = true;
      })
      .addCase(updatePurchaseOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearSuccess, resetPurchaseOrderState } =
  purchaseOrderSlice.actions;
export default purchaseOrderSlice.reducer;
