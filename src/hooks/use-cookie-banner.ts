import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Cookies from 'js-cookie';

import { type ICookieBanner, type ICookieSettingsItem } from '@/types/common';

export type ConsentUpdateFunction = (consentObject: Record<string, boolean>) => void;

export interface IConsentLogic {
  getAcceptValue?: (allSettings: ICookieSettingsItem[]) => Record<string, boolean>;
  getDeclineValue?: (allSettings: ICookieSettingsItem[]) => Record<string, boolean>;
  getSaveValue?: (
    currentSelection: ICookieSettingsItem[],
    allSettings: ICookieSettingsItem[],
  ) => Record<string, boolean>;
}

const useCookie = (
  key: string,
): [string | null, (value: string, options?: Cookies.CookieAttributes) => void] => {
  const [cookieValue, setCookieValue] = useState<string | null>(() => Cookies.get(key) || null);

  const updateCookie = useCallback(
    (value: string, options?: Cookies.CookieAttributes) => {
      Cookies.set(key, value, { expires: 365, path: '/', ...options });
      setCookieValue(value);
    },
    [key],
  );

  return [cookieValue, updateCookie];
};

const parseConsentValue = (cookieValue: string | null): Record<string, boolean> => {
  if (!cookieValue) {
    return {};
  }

  try {
    const parsedValue = JSON.parse(cookieValue);

    if (typeof parsedValue !== 'object' || parsedValue === null) {
      return {};
    }

    return parsedValue as Record<string, boolean>;
  } catch (error) {
    console.error('Error parsing cookie value:', error);
    return {};
  }
};

const initializeCheckboxValues = (
  cookieValue: string | null,
  cookieSettings: ICookieSettingsItem[],
): ICookieSettingsItem[] => {
  const consentObject = parseConsentValue(cookieValue);

  return cookieSettings.map((setting) => ({
    ...setting,
    isChecked: consentObject[setting.value] === true || setting.isRequired,
  }));
};

const defaultConsentLogic: Required<IConsentLogic> = {
  getAcceptValue: (allSettings) => {
    const consent: Record<string, boolean> = {};
    allSettings.forEach((s) => {
      consent[s.value] = true;
    });
    return consent;
  },
  getDeclineValue: (allSettings) => {
    const consent: Record<string, boolean> = {};
    allSettings.forEach((s) => {
      consent[s.value] = s.isRequired;
    });
    return consent;
  },
  getSaveValue: (currentSelection, allSettings) => {
    const consent: Record<string, boolean> = {};
    currentSelection.forEach((s) => {
      consent[s.value] = s.isChecked;
    });
    allSettings.forEach((s) => {
      if (!(s.value in consent)) {
        consent[s.value] = false;
      }
      if (s.isRequired) {
        consent[s.value] = true;
      }
    });
    return consent;
  },
};

const updateGtagConsent: ConsentUpdateFunction = (consentObject) => {
  if (typeof window === 'undefined') {
    return;
  }
  // @ts-expect-error gtag is not defined in the global scope
  if (typeof window?.gtag !== 'function') {
    console.warn('gtag function not found. Cannot update GA consent.');
    return;
  }
  const consentState = {
    analytics_storage: consentObject?.analytics ? 'granted' : 'denied',
    ad_storage: consentObject?.marketing ? 'granted' : 'denied',
  };
  // @ts-expect-error gtag is not defined in the global scope
  window?.gtag('consent', 'update', consentState);
};

interface IUseCookieBannerProps {
  cookieSettings: ICookieSettingsItem[];
  cookieKey: string;
  consentLogic?: IConsentLogic;
  onConsentChange?: ConsentUpdateFunction;
}

export default function useCookieBanner({
  cookieSettings,
  cookieKey,
  consentLogic,
  onConsentChange = updateGtagConsent,
}: IUseCookieBannerProps): ICookieBanner {
  const [cookieValue, updateCookie] = useCookie(cookieKey);
  const [checkboxValues, setCheckboxValues] = useState<ICookieSettingsItem[]>(() =>
    initializeCheckboxValues(cookieValue, cookieSettings),
  );
  const [isCookieBannerVisible, setIsCookieBannerVisible] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const onConsentChangeRef = useRef(onConsentChange);
  const lastAppliedCookieValueRef = useRef<string | null>(null);

  const effectiveConsentLogic = useMemo(() => {
    return { ...defaultConsentLogic, ...(consentLogic ?? {}) };
  }, [consentLogic]);

  const handleOpenSettings = useCallback(() => setIsSettingsOpen(true), []);
  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), []);

  const handleCookieUpdate = useCallback(
    (value: Record<string, boolean>) => {
      const cookieString = JSON.stringify(value);
      updateCookie(cookieString);
      setIsCookieBannerVisible(false);
      setIsSettingsOpen(false);
      setCheckboxValues(initializeCheckboxValues(cookieString, cookieSettings));
    },
    [updateCookie, cookieSettings],
  );

  const handleAcceptClick = useCallback(() => {
    const valueToSet = effectiveConsentLogic.getAcceptValue(cookieSettings);
    handleCookieUpdate(valueToSet);
  }, [handleCookieUpdate, cookieSettings, effectiveConsentLogic]);

  const handleDeclineClick = useCallback(() => {
    const valueToSet = effectiveConsentLogic.getDeclineValue(cookieSettings);
    handleCookieUpdate(valueToSet);
  }, [handleCookieUpdate, cookieSettings, effectiveConsentLogic]);

  const handleSaveClick = useCallback(() => {
    const valueToSet = effectiveConsentLogic.getSaveValue(checkboxValues, cookieSettings);
    handleCookieUpdate(valueToSet);
  }, [handleCookieUpdate, checkboxValues, cookieSettings, effectiveConsentLogic]);

  useEffect(() => {
    onConsentChangeRef.current = onConsentChange;
  }, [onConsentChange]);

  useEffect(() => {
    const currentValues = initializeCheckboxValues(cookieValue, cookieSettings);

    setCheckboxValues(currentValues);

    if (cookieValue === null) {
      lastAppliedCookieValueRef.current = null;
      setIsCookieBannerVisible(true);
    } else {
      setIsCookieBannerVisible(false);

      if (lastAppliedCookieValueRef.current !== cookieValue) {
        lastAppliedCookieValueRef.current = cookieValue;
        onConsentChangeRef.current(parseConsentValue(cookieValue));
      }
    }
  }, [cookieValue, cookieSettings]);

  const handleCheckboxChange = useCallback((index: number) => {
    setCheckboxValues((prevValues) =>
      prevValues.map((checkbox, i) => {
        if (i === index && !checkbox.isRequired) {
          return { ...checkbox, isChecked: !checkbox.isChecked };
        }
        return checkbox;
      }),
    );
  }, []);

  return {
    isCookieBannerVisible,
    checkboxValues,
    handleCheckboxChange,
    handleAcceptClick,
    handleDeclineClick,
    handleSaveClick,
    isCookieSettingsOpen: isSettingsOpen,
    handleOpenCookieSettings: handleOpenSettings,
    handleCloseCookieSettings: handleCloseSettings,
  };
}
