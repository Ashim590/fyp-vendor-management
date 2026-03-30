import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { DELIVERY_API_END_POINT } from "@/utils/constant";

export const createDelivery = createAsyncThunk(
  "delivery/create",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `${DELIVERY_API_END_POINT}/create`,
        formData,
        {
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error creating delivery"
      );
    }
  }
);

export const getAllDeliveries = createAsyncThunk(
  "delivery/getAll",
  async (filters = {}, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${DELIVERY_API_END_POINT}`, {
        params: filters,
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error fetching deliveries"
      );
    }
  }
);

export const getMyDeliveries = createAsyncThunk(
  "delivery/getMy",
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${DELIVERY_API_END_POINT}/my`, {
        params,
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error fetching my deliveries"
      );
    }
  }
);

export const getDeliveryById = createAsyncThunk(
  "delivery/getById",
  async (deliveryId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${DELIVERY_API_END_POINT}/${deliveryId}`,
        {
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error fetching delivery"
      );
    }
  }
);

export const receiveDelivery = createAsyncThunk(
  "delivery/receive",
  async ({ deliveryId, receivedData }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${DELIVERY_API_END_POINT}/${deliveryId}/receive`,
        receivedData,
        {
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error receiving delivery"
      );
    }
  }
);

export const inspectDelivery = createAsyncThunk(
  "delivery/inspect",
  async ({ deliveryId, inspectionData }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${DELIVERY_API_END_POINT}/${deliveryId}/inspect`,
        inspectionData,
        {
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error inspecting delivery"
      );
    }
  }
);

export const updateDeliveryStatus = createAsyncThunk(
  "delivery/updateStatus",
  async ({ deliveryId, status, note }, { rejectWithValue }) => {
    try {
      const response = await axios.patch(
        `${DELIVERY_API_END_POINT}/${deliveryId}/status`,
        { status, note },
        { withCredentials: true }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error updating status"
      );
    }
  }
);

export const recordDeliveryDelay = createAsyncThunk(
  "delivery/recordDelay",
  async ({ deliveryId, reason }, { rejectWithValue }) => {
    try {
      const response = await axios.patch(
        `${DELIVERY_API_END_POINT}/${deliveryId}/delay`,
        { reason },
        { withCredentials: true }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error recording delay"
      );
    }
  }
);

export const addDeliveryComment = createAsyncThunk(
  "delivery/addComment",
  async ({ deliveryId, note }, { rejectWithValue }) => {
    try {
      const response = await axios.patch(
        `${DELIVERY_API_END_POINT}/${deliveryId}/comment`,
        { note },
        { withCredentials: true }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error adding delivery comment"
      );
    }
  }
);

const deliverySlice = createSlice({
  name: "delivery",
  initialState: {
    deliveries: [],
    currentDelivery: null,
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
    resetDeliveryState: (state) => {
      state.deliveries = [];
      state.currentDelivery = null;
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createDelivery.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createDelivery.fulfilled, (state, action) => {
        state.loading = false;
        state.currentDelivery = action.payload.delivery;
        state.success = true;
      })
      .addCase(createDelivery.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getAllDeliveries.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAllDeliveries.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.deliveries = action.payload.deliveries ?? [];
      })
      .addCase(getAllDeliveries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getMyDeliveries.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getMyDeliveries.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.deliveries = action.payload.deliveries ?? [];
      })
      .addCase(getMyDeliveries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getDeliveryById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getDeliveryById.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.currentDelivery = action.payload.delivery;
      })
      .addCase(getDeliveryById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(receiveDelivery.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(receiveDelivery.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.currentDelivery = action.payload.delivery;
        state.success = true;
      })
      .addCase(receiveDelivery.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(inspectDelivery.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(inspectDelivery.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.currentDelivery = action.payload.delivery;
        state.success = true;
      })
      .addCase(inspectDelivery.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateDeliveryStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        const d = action.payload.delivery;
        if (d?._id) {
          const i = state.deliveries.findIndex(
            (x) => String(x._id) === String(d._id)
          );
          if (i >= 0) state.deliveries[i] = d;
        }
      })
      .addCase(recordDeliveryDelay.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        const d = action.payload.delivery;
        if (d?._id) {
          const i = state.deliveries.findIndex(
            (x) => String(x._id) === String(d._id)
          );
          if (i >= 0) state.deliveries[i] = d;
        }
      })
      .addCase(addDeliveryComment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addDeliveryComment.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        const d = action.payload.delivery;
        state.currentDelivery = d || state.currentDelivery;
        if (d?._id) {
          const i = state.deliveries.findIndex(
            (x) => String(x._id) === String(d._id)
          );
          if (i >= 0) state.deliveries[i] = d;
        }
      })
      .addCase(addDeliveryComment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearSuccess, resetDeliveryState } =
  deliverySlice.actions;
export default deliverySlice.reducer;
