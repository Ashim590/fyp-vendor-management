import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { VENDOR_API_END_POINT } from "@/utils/constant";

export const getAllVendors = createAsyncThunk(
  "vendor/getAll",
  async (filters = {}, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${VENDOR_API_END_POINT}`, {
        params: filters,
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error fetching vendors"
      );
    }
  }
);

export const getVendorById = createAsyncThunk(
  "vendor/getById",
  async (vendorId, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${VENDOR_API_END_POINT}/${vendorId}`, {
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error fetching vendor"
      );
    }
  }
);

export const updateVendor = createAsyncThunk(
  "vendor/update",
  async ({ vendorId, formData }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${VENDOR_API_END_POINT}/${vendorId}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error updating vendor"
      );
    }
  }
);

export const approveVendor = createAsyncThunk(
  "vendor/approve",
  async (vendorId, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${VENDOR_API_END_POINT}/${vendorId}/approve`,
        {},
        {
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error approving vendor"
      );
    }
  }
);

export const rejectVendor = createAsyncThunk(
  "vendor/reject",
  async ({ vendorId, rejectionReason }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${VENDOR_API_END_POINT}/${vendorId}/reject`,
        { rejectionReason },
        {
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error rejecting vendor"
      );
    }
  }
);

export const getVendorStats = createAsyncThunk(
  "vendor/stats",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${VENDOR_API_END_POINT}/stats`, {
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Error fetching vendor stats"
      );
    }
  }
);

const vendorSlice = createSlice({
  name: "vendor",
  initialState: {
    vendors: [],
    currentVendor: null,
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
    resetVendorState: (state) => {
      state.vendors = [];
      state.currentVendor = null;
      state.stats = null;
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // Get All Vendors
      .addCase(getAllVendors.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAllVendors.fulfilled, (state, action) => {
        state.loading = false;
        state.vendors = action.payload.vendors;
      })
      .addCase(getAllVendors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get Vendor By ID
      .addCase(getVendorById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getVendorById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentVendor = action.payload.vendor;
      })
      .addCase(getVendorById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Update Vendor
      .addCase(updateVendor.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateVendor.fulfilled, (state, action) => {
        state.loading = false;
        state.currentVendor = action.payload.vendor;
        state.success = true;
      })
      .addCase(updateVendor.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Approve Vendor
      .addCase(approveVendor.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(approveVendor.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        const index = state.vendors.findIndex(
          (v) => v._id === action.payload.vendor._id
        );
        if (index !== -1) {
          state.vendors[index] = action.payload.vendor;
        }
      })
      .addCase(approveVendor.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Reject Vendor
      .addCase(rejectVendor.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(rejectVendor.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(rejectVendor.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get Vendor Stats
      .addCase(getVendorStats.pending, (state) => {
        state.loading = true;
      })
      .addCase(getVendorStats.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = action.payload.stats;
      })
      .addCase(getVendorStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearSuccess, resetVendorState } =
  vendorSlice.actions;
export default vendorSlice.reducer;
