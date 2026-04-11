import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { INVOICE_API_END_POINT } from "@/utils/constant";

export const createInvoice = createAsyncThunk(
  "invoice/create",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `${INVOICE_API_END_POINT}/create`,
        formData,
        {
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, "Error creating invoice"),
      );
    }
  }
);

export const getAllInvoices = createAsyncThunk(
  "invoice/getAll",
  async (filters = {}, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${INVOICE_API_END_POINT}`, {
        params: filters,
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, "Error fetching invoices"),
      );
    }
  }
);

export const getInvoiceById = createAsyncThunk(
  "invoice/getById",
  async (invoiceId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${INVOICE_API_END_POINT}/${invoiceId}`,
        {
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, "Error fetching invoice"),
      );
    }
  }
);

export const updateInvoice = createAsyncThunk(
  "invoice/update",
  async ({ invoiceId, formData }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${INVOICE_API_END_POINT}/${invoiceId}`,
        formData,
        {
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, "Error updating invoice"),
      );
    }
  }
);

const invoiceSlice = createSlice({
  name: "invoice",
  initialState: {
    invoices: [],
    currentInvoice: null,
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
    resetInvoiceState: (state) => {
      state.invoices = [];
      state.currentInvoice = null;
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createInvoice.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createInvoice.fulfilled, (state, action) => {
        state.loading = false;
        state.currentInvoice = action.payload.invoice;
        state.success = true;
      })
      .addCase(createInvoice.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getAllInvoices.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAllInvoices.fulfilled, (state, action) => {
        state.loading = false;
        state.invoices = Array.isArray(action.payload?.invoices)
          ? action.payload.invoices
          : [];
      })
      .addCase(getAllInvoices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getInvoiceById.pending, (state) => {
        state.loading = true;
      })
      .addCase(getInvoiceById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentInvoice = action.payload.invoice;
      })
      .addCase(getInvoiceById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateInvoice.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateInvoice.fulfilled, (state, action) => {
        state.loading = false;
        state.currentInvoice = action.payload.invoice;
        state.success = true;
      })
      .addCase(updateInvoice.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearSuccess, resetInvoiceState } =
  invoiceSlice.actions;
export default invoiceSlice.reducer;
