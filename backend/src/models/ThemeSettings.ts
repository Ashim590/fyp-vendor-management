import mongoose, { Schema, Document } from 'mongoose';

export interface IThemeSettings extends Document {
  primaryColor: string;
  secondaryColor: string;
}

const ThemeSettingsSchema: Schema<IThemeSettings> = new Schema(
  {
    primaryColor: { type: String, default: '#2563eb' }, // blue
    secondaryColor: { type: String, default: '#16a34a' } // green
  },
  { timestamps: true }
);

export default mongoose.model<IThemeSettings>('ThemeSettings', ThemeSettingsSchema);

