import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { APPROVAL_API_END_POINT } from "@/utils/constant";
import { getAuthHeaderFromStorage } from "@/utils/authHeader";

/** Normalize API error message for toast / state (string or validation array). */
function approvalErrorMessage(error, fallback) {
  const raw = error?.response?.data?.message ?? error?.response?.data?.error;
  if (Array.isArray(raw)) return raw.map(String).join(", ");
  if (typeof raw === "string" && raw.trim()) return raw;
  if (error?.message === "Network Error")
    return "Cannot reach server. Is the API running and reachable?";
  return fallback;
}

const approvalAxiosConfig = () => ({
  withCredentials: true,
  headers: { ...getAuthHeaderFromStorage() },
});

export const createApproval = createAsyncThunk(
  "approval/create",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `${APPROVAL_API_END_POINT}/create`,
        formData,
        approvalAxiosConfig(),
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        approvalErrorMessage(error, "Error creating approval"),
      );
    }
  }
);

export const getMyPendingApprovals = createAsyncThunk(
  "approval/getMyPending",
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${APPROVAL_API_END_POINT}/my-pending`,
        { ...approvalAxiosConfig(), params },
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        approvalErrorMessage(error, "Error fetching pending approvals"),
      );
    }
  }
);

export const getAllApprovals = createAsyncThunk(
  "approval/getAll",
  async (filters = {}, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${APPROVAL_API_END_POINT}`, {
        ...approvalAxiosConfig(),
        params: filters,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        approvalErrorMessage(error, "Error fetching approvals"),
      );
    }
  }
);

export const approveRequest = createAsyncThunk(
  "approval/approve",
  async ({ approvalId, comments }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${APPROVAL_API_END_POINT}/${approvalId}/approve`,
        { comments },
        approvalAxiosConfig(),
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        approvalErrorMessage(error, "Error approving request"),
      );
    }
  }
);

export const rejectApprovalRequest = createAsyncThunk(
  "approval/reject",
  async ({ approvalId, rejectionReason }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${APPROVAL_API_END_POINT}/${approvalId}/reject`,
        { rejectionReason },
        approvalAxiosConfig(),
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        approvalErrorMessage(error, "Error rejecting request"),
      );
    }
  }
);

export const getApprovalById = createAsyncThunk(
  "approval/getById",
  async (approvalId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${APPROVAL_API_END_POINT}/${approvalId}`,
        approvalAxiosConfig(),
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        approvalErrorMessage(error, "Error fetching approval"),
      );
    }
  }
);

const approvalSlice = createSlice({
  name: "approval",
  initialState: {
    approvals: [],
    pendingApprovals: [],
    currentApproval: null,
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
    resetApprovalState: (state) => {
      state.approvals = [];
      state.pendingApprovals = [];
      state.currentApproval = null;
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getMyPendingApprovals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getMyPendingApprovals.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.pendingApprovals = action.payload.approvals;
      })
      .addCase(getMyPendingApprovals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getAllApprovals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAllApprovals.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.approvals = action.payload.approvals;
      })
      .addCase(getAllApprovals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(approveRequest.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(approveRequest.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.success = true;
      })
      .addCase(approveRequest.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(rejectApprovalRequest.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(rejectApprovalRequest.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.success = true;
      })
      .addCase(rejectApprovalRequest.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getApprovalById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getApprovalById.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.currentApproval = action.payload.approval;
      })
      .addCase(getApprovalById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearSuccess, resetApprovalState } =
  approvalSlice.actions;
export default approvalSlice.reducer;
