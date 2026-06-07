import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => ({
  locale: "ar",
  messages: (await import("../../messages/ar.json")).default,
}));
