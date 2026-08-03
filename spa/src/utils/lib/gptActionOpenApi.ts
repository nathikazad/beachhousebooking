const errorResponse = {
  description: "Request failed",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  },
};

export function createGptActionOpenApi(baseUrl: string) {
  const serverUrl = new URL(baseUrl);
  serverUrl.pathname = serverUrl.pathname.replace(/\/$/, "");
  serverUrl.search = "";
  serverUrl.hash = "";

  return {
    openapi: "3.1.0",
    info: {
      title: "Beach House Booking Operations",
      description:
        "Read-only access to Beach House booking, financial, event schedule, employee performance, and conflict information. Monetary values are INR. Relative dates use Asia/Kolkata.",
      version: "1.0.0",
    },
    servers: [{ url: serverUrl.toString().replace(/\/$/, "") }],
    security: [{ BearerAuth: [] }],
    paths: {
      "/api/gpt/v1/bookings/{bookingId}": {
        get: {
          operationId: "getBookingDetails",
          summary: "Get one booking by booking number",
          description:
            "Returns the latest operational and financial details for one booking. Use whenever the user mentions a specific booking number.",
          parameters: [
            {
              name: "bookingId",
              in: "path",
              required: true,
              schema: { type: "integer", minimum: 1 },
              description: "Numeric booking number, for example 2542.",
            },
          ],
          responses: {
            "200": { description: "Latest booking details" },
            "400": errorResponse,
            "401": errorResponse,
            "404": errorResponse,
          },
        },
      },
      "/api/gpt/v1/bookings": {
        get: {
          operationId: "searchBookings",
          summary: "Search and filter bookings",
          description:
            "Search bookings by client, creator, status, type, property, created/check-in date range, or outstanding balance. Date ranges have an inclusive from date and exclusive to date.",
          parameters: [
            { name: "client", in: "query", schema: { type: "string" } },
            {
              name: "employee",
              in: "query",
              schema: {
                type: "string",
                enum: ["Indhu", "Thejas", "Yasmeen", "Rafica"],
              },
              description: "Employee who originally acquired/created the booking.",
            },
            {
              name: "status",
              in: "query",
              schema: {
                type: "string",
                enum: ["inquiry", "quotation", "preconfirmed", "confirmed"],
              },
            },
            {
              name: "bookingType",
              in: "query",
              schema: { type: "string", enum: ["Stay", "Event"] },
            },
            {
              name: "property",
              in: "query",
              schema: {
                type: "string",
                enum: [
                  "Bluehouse",
                  "Glasshouse",
                  "Meadow Lane",
                  "Le Chalet",
                  "Villa Armati",
                  "Castle",
                ],
              },
            },
            {
              name: "from",
              in: "query",
              schema: { type: "string", format: "date" },
            },
            {
              name: "to",
              in: "query",
              schema: { type: "string", format: "date" },
            },
            {
              name: "dateBasis",
              in: "query",
              schema: { type: "string", enum: ["created", "checkIn"], default: "created" },
            },
            {
              name: "outstandingOnly",
              in: "query",
              schema: { type: "boolean", default: false },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: 50, default: 25 },
            },
          ],
          responses: {
            "200": { description: "Matching booking summaries" },
            "400": errorResponse,
            "401": errorResponse,
          },
        },
      },
      "/api/gpt/v1/metrics": {
        get: {
          operationId: "getBusinessMetrics",
          summary: "Get monthly financial and employee performance metrics",
          description:
            "Returns cash collected by payment date, confirmed bookings acquired by creation date, confirmed booking value, tax, outstanding balance, check-in value, inquiries, and conversion rate. If employee is supplied, every metric is limited to bookings originally created by that employee.",
          parameters: [
            {
              name: "month",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: 12 },
              description: "Calendar month number. Defaults to the current month in Asia/Kolkata.",
            },
            {
              name: "year",
              in: "query",
              schema: { type: "integer", minimum: 2000, maximum: 2100 },
              description: "Four-digit year. Defaults to the current year in Asia/Kolkata.",
            },
            {
              name: "employee",
              in: "query",
              schema: {
                type: "string",
                enum: ["Indhu", "Thejas", "Yasmeen", "Rafica"],
              },
            },
          ],
          responses: {
            "200": { description: "Monthly business metrics in INR" },
            "400": errorResponse,
            "401": errorResponse,
          },
        },
      },
      "/api/gpt/v1/events": {
        get: {
          operationId: "getEventSchedule",
          summary: "Get events happening on a date",
          description:
            "Returns confirmed and preconfirmed event periods overlapping the selected calendar date in Asia/Kolkata. By default stays are excluded.",
          parameters: [
            {
              name: "date",
              in: "query",
              required: true,
              schema: { type: "string", format: "date" },
            },
            {
              name: "includeStays",
              in: "query",
              schema: { type: "boolean", default: false },
            },
          ],
          responses: {
            "200": { description: "Daily event schedule" },
            "400": errorResponse,
            "401": errorResponse,
          },
        },
      },
      "/api/gpt/v1/conflicts": {
        get: {
          operationId: "getBookingConflicts",
          summary: "Get upcoming booking conflicts",
          description:
            "Returns upcoming confirmed or preconfirmed booking periods that overlap at the same property.",
          responses: {
            "200": { description: "Grouped upcoming booking conflicts" },
            "401": errorResponse,
          },
        },
      },
    },
    components: {
      schemas: {},
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
    },
  };
}
