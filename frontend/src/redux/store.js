import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authSlice from "./authSlice";
import jobSlice from "./jobSlice";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";
import companySlice from "./companySlice";
import applicationSlice from "./applicationSlice";
import vendorSlice from "./vendorSlice";
import purchaseRequestSlice from "./purchaseRequestSlice";
import quotationSlice from "./quotationSlice";
import approvalSlice from "./approvalSlice";
import purchaseOrderSlice from "./purchaseOrderSlice";
import deliverySlice from "./deliverySlice";
import invoiceSlice from "./invoiceSlice";

const persistConfig = {
  key: "root",
  version: 3,
  storage,
  // Auth is persisted separately so transient flags like `loading`
  // are never rehydrated into stuck UI states.
  // Vendor list often includes large base64 logos — persisting it hits
  // localStorage quota and can rehydrate stale rows without images.
  blacklist: ["auth", "vendor"],
};

const authPersistConfig = {
  key: "auth",
  version: 1,
  storage,
  whitelist: ["user", "token"],
};

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authSlice),
  job: jobSlice,
  company: companySlice,
  application: applicationSlice,
  vendor: vendorSlice,
  purchaseRequest: purchaseRequestSlice,
  quotation: quotationSlice,
  approval: approvalSlice,
  purchaseOrder: purchaseOrderSlice,
  delivery: deliverySlice,
  invoice: invoiceSlice,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

/** Used by PersistGate, Login flush, etc. Single instance so persist timings stay consistent. */
export const persistor = persistStore(store);
export default store;
