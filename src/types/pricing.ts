import { ILucideIcon } from '@/types/common';

export type PricingPlanId = string;

export type PricingMatrixValue = boolean | string | { title: string; description: string };

export interface IPricingTablePlanValue {
  planId: PricingPlanId;
  value: PricingMatrixValue;
}

export interface IPricingTableFeatureRow {
  name: string;
  description?: string;
  tooltip?: string;
  plans: IPricingTablePlanValue[];
}

export interface IPricingTableFeatures {
  name: string;
  features: IPricingTableFeatureRow[];
}

export interface IPricingFeature {
  name: string;
  included: boolean | string;
}

export interface IPricingPlanFeature extends Partial<ILucideIcon> {
  label: string;
  tooltip?: string;
}

interface IPricingPlanBase extends Partial<ILucideIcon> {
  id: string;
  name: string;
  description: string;
  currency: string;
  labelBeforePrice?: string;
  isMostPopular?: boolean;
  features: {
    title?: string;
    items: IPricingPlanFeature[];
  };
  link: {
    label: string;
    href: string;
  };
}

export interface INumberPricingPlan extends IPricingPlanBase {
  priceType: 'number';
  monthlyPrice: number;
  annualPrice: number;
  monthlyPriceDisplay?: string;
  annualPriceDisplay?: string;
  priceMonthlyLabel: string;
  priceAnnualLabel: string;
}

export interface IStringPricingPlan extends IPricingPlanBase {
  priceType: 'string';
  monthlyPrice?: number;
  annualPrice?: number;
  monthlyPriceDisplay: string;
  annualPriceDisplay: string;
  priceMonthlyLabel?: string;
  priceAnnualLabel?: string;
}

export type IPricingPlan = INumberPricingPlan | IStringPricingPlan;
