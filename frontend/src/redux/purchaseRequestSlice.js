import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { PURCHASE_REQUEST_API_END_POINT } from "@/utils/constant";

export const createPurchaseRequest = createAsyncThunk(
  "purchaseRequest/create",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `${PURCHASE_REQUEST_API_END_POINT}/create`,
        formData,
        {
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error creating purchase request"
      );
    }
  }
);

export const getAllPurchaseRequests = createAsyncThunk(
  "purchaseRequest/getAll",
  async (filters = {}, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${PURCHASE_REQUEST_API_END_POINT}`, {
        params: filters,
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error fetching purchase requests"
      );
    }
  }
);

export const getMyPurchaseRequests = createAsyncThunk(
  "purchaseRequest/getMy",
  async (filters = {}, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${PURCHASE_REQUEST_API_END_POINT}/my`, {
        params: filters,
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error fetching your purchase requests"
      );
    }
  }
);

export const getPurchaseRequestById = createAsyncThunk(
  "purchaseRequest/getById",
  async (requestId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${PURCHASE_REQUEST_API_END_POINT}/${requestId}`,
        {
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error fetching purchase request"
      );
    }
  }
);

export const updatePurchaseRequest = createAsyncThunk(
  "purchaseRequest/update",
  async ({ requestId, formData }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${PURCHASE_REQUEST_API_END_POINT}/${requestId}`,
        formData,
        {
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error updating purchase request"
      );
    }
  }
);

export const submitForApproval = createAsyncThunk(
  "purchaseRequest/submit",
  async (requestId, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${PURCHASE_REQUEST_API_END_POINT}/${requestId}/submit`,
        {},
        {
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error submitting for approval"
      );
    }
  }
);

export const cancelPurchaseRequest = createAsyncThunk(
  "purchaseRequest/cancel",
  async ({ requestId, cancellationReason }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${PURCHASE_REQUEST_API_END_POINT}/${requestId}/cancel`,
        { cancellationReason },
        { withCredentials: true }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error cancelling purchase request"
      );
    }
  }
);

export const getPurchaseRequestStats = createAsyncThunk(
  "purchaseRequest/stats",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${PURCHASE_REQUEST_API_END_POINT}/stats`,
        {
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error fetching statistics"
      );
    }
  }
);

export const deletePurchaseRequest = createAsyncThunk(
  "purchaseRequest/delete",
  async (requestId, { rejectWithValue }) => {
    try {
      const response = await axios.delete(
        `${PURCHASE_REQUEST_API_END_POINT}/${requestId}`,
        {
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error deleting purchase request"
      );
    }
  }
);

const purchaseRequestSlice = createSlice({
  name: "purchaseRequest",
  initialState: {
    purchaseRequests: [],
    myPurchaseRequests: [],
    currentPurchaseRequest: null,
    stats: null,
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
    resetPurchaseRequestState: (state) => {
      state.purchaseRequests = [];
      state.myPurchaseRequests = [];
      state.currentPurchaseRequest = null;
      state.stats = null;
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // Create Purchase Request
      .addCase(createPurchaseRequest.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createPurchaseRequest.fulfilled, (state, action) => {
        state.loading = false;
        state.currentPurchaseRequest = action.payload.purchaseRequest;
        state.success = true;
      })
      .addCase(createPurchaseRequest.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get All Purchase Requests
      .addCase(getAllPurchaseRequests.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAllPurchaseRequests.fulfilled, (state, action) => {
        state.loading = false;
        state.purchaseRequests = action.payload.purchaseRequests;
      })
      .addCase(getAllPurchaseRequests.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get My Purchase Requests
      .addCase(getMyPurchaseRequests.pending, (state) => {
        state.loading = true;
      })
      .addCase(getMyPurchaseRequests.fulfilled, (state, action) => {
        state.loading = false;
        state.myPurchaseRequests = action.payload.purchaseRequests;
      })
      .addCase(getMyPurchaseRequests.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get Purchase Request By ID
      .addCase(getPurchaseRequestById.pending, (state) => {
        state.loading = true;
      })
      .addCase(getPurchaseRequestById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentPurchaseRequest = action.payload.purchaseRequest;
      })
      .addCase(getPurchaseRequestById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Update Purchase Request
      .addCase(updatePurchaseRequest.pending, (state) => {
        state.loading = true;
      })
      .addCase(updatePurchaseRequest.fulfilled, (state, action) => {
        state.loading = false;
        state.currentPurchaseRequest = action.payload.purchaseRequest;
        state.success = true;
      })
      .addCase(updatePurchaseRequest.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Submit for Approval
      .addCase(submitForApproval.pending, (state) => {
        state.loading = true;
      })
      .addCase(submitForApproval.fulfilled, (state, action) => {
        state.loading = false;
        state.currentPurchaseRequest = action.payload.purchaseRequest;
        state.success = true;
      })
      .addCase(submitForApproval.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Cancel Purchase Request
      .addCase(cancelPurchaseRequest.pending, (state) => {
        state.loading = true;
      })
      .addCase(cancelPurchaseRequest.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(cancelPurchaseRequest.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get Stats
      .addCase(getPurchaseRequestStats.pending, (state) => {
        state.loading = true;
      })
      .addCase(getPurchaseRequestStats.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = action.payload.stats;
      })
      .addCase(getPurchaseRequestStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Delete Purchase Request
      .addCase(deletePurchaseRequest.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deletePurchaseRequest.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.purchaseRequests = state.purchaseRequests.filter(
          (pr) => pr._id !== action.meta.arg
        );
      })
      .addCase(deletePurchaseRequest.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearSuccess, resetPurchaseRequestState } =
  purchaseRequestSlice.actions;
export default purchaseRequestSlice.reducer;
