import {
  ORIGINAL_FLYER_BASE_HEIGHT,
  ORIGINAL_FLYER_MIN_QR_BOTTOM_PERCENT,
  ORIGINAL_FLYER_TOP_RATIO,
} from "@/lib/invitation/originalFlyerLayout";
import type {
  FlyerConfiguration,
} from "@/lib/types/flyer";

export const STUB_GUEST_LEFT_MIN = 0;
export const STUB_GUEST_LEFT_MAX = 36;
export const STUB_GUEST_TOP_MIN = 0;

export const STUB_DETAILS_LEFT_MIN = 0;
export const STUB_DETAILS_LEFT_MAX = 56;
export const STUB_DETAILS_TOP_MIN = 0;

export const STUB_QR_SIZE_MIN = 10;
export const STUB_QR_SIZE_MAX = 36;
export const STUB_QR_RIGHT_MIN = 0;
export const STUB_QR_BOTTOM_MIN =
  ORIGINAL_FLYER_MIN_QR_BOTTOM_PERCENT;

export const STUB_REFERENCE_HEIGHT =
  ORIGINAL_FLYER_BASE_HEIGHT *
  (1 - ORIGINAL_FLYER_TOP_RATIO);

const GUEST_RIGHT_PERCENT = 40;
const EVENT_DETAILS_WIDTH_PERCENT = 44;
const EVENT_DETAIL_ROW_HEIGHT_PX = 15;
const EVENT_DETAIL_GAP_PX = 6;

export function clampStubValue(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    Math.max(value, minimum),
    maximum,
  );
}

export function roundStubPercentage(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getStubHeight(frameHeight: number): number {
  return frameHeight * (1 - ORIGINAL_FLYER_TOP_RATIO);
}

export function getGuestBlockHeightPercent(
  configuration: FlyerConfiguration,
  stubHeight: number,
  guestNameLength: number,
  hasCategory: boolean,
): number {
  const guestNameSize = Math.max(
    12,
    Math.round(
      configuration.stub_guest_name_font_size *
        Math.min(1, 14 / Math.max(guestNameLength, 1)),
    ),
  );
  const categorySize = Math.max(
    11,
    Math.round(configuration.stub_guest_name_font_size * 0.68),
  );
  const contentHeight =
    guestNameSize * 1.2 +
    (hasCategory
      ? EVENT_DETAIL_GAP_PX + categorySize * 1.2 + 12
      : 0);

  return (contentHeight / Math.max(stubHeight, 1)) * 100;
}

export function getEventDetailsHeightPercent(
  configuration: FlyerConfiguration,
  stubHeight: number,
): number {
  const detailCount = [
    configuration.stub_show_event_date,
    configuration.stub_show_event_time,
    configuration.stub_show_event_location,
  ].filter(Boolean).length;
  const contentHeight =
    detailCount * EVENT_DETAIL_ROW_HEIGHT_PX +
    Math.max(0, detailCount - 1) * EVENT_DETAIL_GAP_PX;

  return (contentHeight / Math.max(stubHeight, 1)) * 100;
}

export function getGuestTopMaximum(
  configuration: FlyerConfiguration,
  stubHeight: number,
  guestNameLength: number,
  hasCategory: boolean,
): number {
  return Math.max(
    STUB_GUEST_TOP_MIN,
    100 -
      getGuestBlockHeightPercent(
        configuration,
        stubHeight,
        guestNameLength,
        hasCategory,
      ),
  );
}

export function getEventDetailsTopMaximum(
  configuration: FlyerConfiguration,
  stubHeight: number,
): number {
  return Math.max(
    STUB_DETAILS_TOP_MIN,
    100 -
      getEventDetailsHeightPercent(
        configuration,
        stubHeight,
      ),
  );
}

export function getQrHeightPercent(
  qrSizePercent: number,
): number {
  const invitationWidthToHeight = 9 / 16;
  return (
    qrSizePercent *
    invitationWidthToHeight /
    (1 - ORIGINAL_FLYER_TOP_RATIO)
  );
}

export function getQrRightMaximum(
  size: number,
): number {
  return Math.max(
    STUB_QR_RIGHT_MIN,
    100 - size,
  );
}

export function getQrBottomMinimum(
  size: number,
): number {
  return Math.min(
    STUB_QR_BOTTOM_MIN,
    Math.max(0, 100 - getQrHeightPercent(size)),
  );
}

export function getQrBottomMaximum(
  size: number,
): number {
  return Math.max(
    getQrBottomMinimum(size),
    100 - getQrHeightPercent(size),
  );
}

export const STUB_GUEST_RENDERER_RIGHT = GUEST_RIGHT_PERCENT;
export const STUB_DETAILS_RENDERER_WIDTH = EVENT_DETAILS_WIDTH_PERCENT;
