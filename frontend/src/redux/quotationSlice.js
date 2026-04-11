import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { QUOTATION_API_END_POINT } from "@/utils/constant";

export const submitQuotation = createAsyncThunk(
  "quotation/submit",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `${QUOTATION_API_END_POINT}/create`,
        formData,
        {
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, "Error submitting quotation")
      );
    }
  }
);

export const getQuotationsByPurchaseRequest = createAsyncThunk(
  "quotation/getByPR",
  async (requestId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${QUOTATION_API_END_POINT}/request/${requestId}`,
        {
          params: { limit: 100 },
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, "Error fetching quotations")
      );
    }
  }
);

export const getAllQuotations = createAsyncThunk(
  "quotation/getAll",
  async (filters = {}, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${QUOTATION_API_END_POINT}`, {
        params: filters,
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, "Error fetching quotations")
      );
    }
  }
);

export const getQuotationById = createAsyncThunk(
  "quotation/getById",
  async (quotationId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${QUOTATION_API_END_POINT}/${quotationId}`,
        {
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, "Error fetching quotation")
      );
    }
  }
);

export const acceptQuotation = createAsyncThunk(
  "quotation/accept",
  async ({ quotationId, comparisonNotes }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${QUOTATION_API_END_POINT}/${quotationId}/accept`,
        { comparisonNotes },
        { withCredentials: true }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, "Error accepting quotation")
      );
    }
  }
);

export const rejectQuotation = createAsyncThunk(
  "quotation/reject",
  async ({ quotationId, rejectionReason }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${QUOTATION_API_END_POINT}/${quotationId}/reject`,
        { rejectionReason },
        { withCredentials: true }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, "Error rejecting quotation")
      );
    }
  }
);

const quotationSlice = createSlice({
  name: "quotation",
  initialState: {
    quotations: [],
    currentQuotation: null,
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
    resetQuotationState: (state) => {
      state.quotations = [];
      state.currentQuotation = null;
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitQuotation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(submitQuotation.fulfilled, (state, action) => {
        state.loading = false;
        state.currentQuotation = action.payload.quotation;
        state.success = true;
      })
      .addCase(submitQuotation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getQuotationsByPurchaseRequest.pending, (state) => {
        state.loading = true;
      })
      .addCase(getQuotationsByPurchaseRequest.fulfilled, (state, action) => {
        state.loading = false;
        state.quotations = action.payload.quotations;
      })
      .addCase(getQuotationsByPurchaseRequest.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getAllQuotations.pending, (state) => {
        state.loading = true;
      })
      .addCase(getAllQuotations.fulfilled, (state, action) => {
        state.loading = false;
        state.quotations = action.payload.quotations;
      })
      .addCase(getAllQuotations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getQuotationById.pending, (state) => {
        state.loading = true;
      })
      .addCase(getQuotationById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentQuotation = action.payload.quotation;
      })
      .addCase(getQuotationById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(acceptQuotation.pending, (state) => {
        state.loading = true;
      })
      .addCase(acceptQuotation.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(acceptQuotation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(rejectQuotation.pending, (state) => {
        state.loading = true;
      })
      .addCase(rejectQuotation.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(rejectQuotation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearSuccess, resetQuotationState } =
  quotationSlice.actions;
export default quotationSlice.reducer;
