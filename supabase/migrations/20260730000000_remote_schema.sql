


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."property" AS ENUM (
    'bluehouse',
    'glasshouse',
    'meadowlane',
    'lechalet',
    'villaarmati',
    'castle'
);


ALTER TYPE "public"."property" OWNER TO "postgres";


CREATE TYPE "public"."status" AS ENUM (
    'inquiry',
    'quotation',
    'confirmed',
    'cancelled',
    'preconfirmed'
);


ALTER TYPE "public"."status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_booking_stats"("month" integer, "year" integer, "referral" "text" DEFAULT NULL::"text", "employee" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$DECLARE
    result JSONB;
    daily_stats JSONB := '{}';
    monthly_stats JSONB;
    day INTEGER;
BEGIN
    -- Calculate the monthly stats
    monthly_stats := jsonb_build_object(
        'inquiriesCount', (
            SELECT COUNT(*) FROM bookings
            WHERE EXTRACT(MONTH FROM created_at) = month
            AND EXTRACT(YEAR FROM created_at) = year
            AND (referral IS NULL OR referral = bookings.referred_by)
            AND (employee IS NULL OR employee = bookings.email)
        ),
        'quotationsCount', (
            SELECT COUNT(*) FROM bookings
            WHERE EXTRACT(MONTH FROM created_at) = month
            AND EXTRACT(YEAR FROM created_at) = year
            AND (status = 'quotation' OR status = 'confirmed')
            AND (referral IS NULL OR referral = bookings.referred_by)
            AND (employee IS NULL OR employee = bookings.email)
        ),
        'confirmedCount', (
            SELECT COUNT(*) FROM bookings
            WHERE EXTRACT(MONTH FROM created_at) = month
            AND EXTRACT(YEAR FROM created_at) = year
            AND status = 'confirmed'
            AND (referral IS NULL OR referral = bookings.referred_by)
            AND (employee IS NULL OR employee = bookings.email)
        ),
        'confirmedSum', (
            SELECT COALESCE(SUM(total_cost), 0) FROM bookings
            WHERE EXTRACT(MONTH FROM created_at) = month
            AND EXTRACT(YEAR FROM created_at) = year
            AND status = 'confirmed'
            AND (referral IS NULL OR referral = bookings.referred_by)
            AND (employee IS NULL OR employee = bookings.email)
        ),
        'confirmedAvg', (
            SELECT COALESCE(AVG(total_cost), 0) FROM bookings
            WHERE EXTRACT(MONTH FROM created_at) = month
            AND EXTRACT(YEAR FROM created_at) = year
            AND status = 'confirmed'
            AND (referral IS NULL OR referral = bookings.referred_by)
            AND (employee IS NULL OR employee = bookings.email)
        ),
        'taxTotal', (
            SELECT COALESCE(SUM(tax), 0) FROM bookings
            WHERE EXTRACT(MONTH FROM created_at) = month
            AND EXTRACT(YEAR FROM created_at) = year
            AND status = 'confirmed'
            AND (referral IS NULL OR referral = bookings.referred_by)
            AND (employee IS NULL OR employee = bookings.email)
        )
    );

    -- Calculate the daily stats
    FOR day IN 1..31 LOOP
        daily_stats := daily_stats || jsonb_build_object(
            day::TEXT, jsonb_build_object(
                'inquiriesCount', (
                    SELECT COUNT(*) FROM bookings
                    WHERE EXTRACT(DAY FROM created_at) = day
                    AND EXTRACT(MONTH FROM created_at) = month
                    AND EXTRACT(YEAR FROM created_at) = year
                    AND (referral IS NULL OR referral = bookings.referred_by)
                    AND (employee IS NULL OR employee = bookings.email)
                ),
                'quotationsCount', (
                    SELECT COUNT(*) FROM bookings
                    WHERE EXTRACT(DAY FROM created_at) = day
                    AND EXTRACT(MONTH FROM created_at) = month
                    AND EXTRACT(YEAR FROM created_at) = year
                    AND (status = 'quotation' OR status = 'confirmed')
                    AND (referral IS NULL OR referral = bookings.referred_by)
                    AND (employee IS NULL OR employee = bookings.email)
                ),
                'confirmedCount', (
                    SELECT COUNT(*) FROM bookings
                    WHERE EXTRACT(DAY FROM created_at) = day
                    AND EXTRACT(MONTH FROM created_at) = month
                    AND EXTRACT(YEAR FROM created_at) = year
                    AND status = 'confirmed'
                    AND (referral IS NULL OR referral = bookings.referred_by)
                    AND (employee IS NULL OR employee = bookings.email)
                ),
                'confirmedSum', (
                    SELECT COALESCE(SUM(total_cost), 0) FROM bookings
                    WHERE EXTRACT(DAY FROM created_at) = day
                    AND EXTRACT(MONTH FROM created_at) = month
                    AND EXTRACT(YEAR FROM created_at) = year
                    AND status = 'confirmed'
                    AND (referral IS NULL OR referral = bookings.referred_by)
                    AND (employee IS NULL OR employee = bookings.email)
                )
            )
        );
    END LOOP;

    -- Build the final JSON result
    result := jsonb_build_object(
        'monthly', monthly_stats,
        'daily', daily_stats
    );

    RETURN result;
END;$$;


ALTER FUNCTION "public"."get_booking_stats"("month" integer, "year" integer, "referral" "text", "employee" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_checkin_stats"("month" integer, "year" integer, "referral" "text" DEFAULT NULL::"text", "employee" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$DECLARE
    result JSONB;
    daily_stats JSONB := '{}';
    monthly_stats JSONB;
    day INTEGER;
BEGIN
    -- Calculate the monthly stats
    monthly_stats := jsonb_build_object(
        'sum', (
            SELECT COALESCE(SUM(total_cost), 0) FROM bookings
            WHERE EXTRACT(MONTH FROM check_in) = month
            AND EXTRACT(YEAR FROM check_in) = year
            AND status = 'confirmed'
            AND (referral IS NULL OR referral = bookings.referred_by)
            AND (employee IS NULL OR employee = bookings.email)
        ),
        'average', (
            SELECT COALESCE(AVG(total_cost), 0) FROM bookings
            WHERE EXTRACT(MONTH FROM check_in) = month
            AND EXTRACT(YEAR FROM check_in) = year
            AND status = 'confirmed'
            AND (referral IS NULL OR referral = bookings.referred_by)
            AND (employee IS NULL OR employee = bookings.email)
        ),
        'count', (
            SELECT COUNT(*) FROM bookings
            WHERE EXTRACT(MONTH FROM check_in) = month
            AND EXTRACT(YEAR FROM check_in) = year
            AND status = 'confirmed'
            AND (referral IS NULL OR referral = bookings.referred_by)
            AND (employee IS NULL OR employee = bookings.email)
        ),
        'taxTotal', (
            SELECT COALESCE(SUM(tax), 0) FROM bookings
            WHERE EXTRACT(MONTH FROM check_in) = month
            AND EXTRACT(YEAR FROM check_in) = year
            AND status = 'confirmed'
            AND (referral IS NULL OR referral = bookings.referred_by)
            AND (employee IS NULL OR employee = bookings.email)
        )
    );

    -- Calculate the daily stats
    FOR day IN 1..31 LOOP
        daily_stats := daily_stats || jsonb_build_object(
            day::TEXT, jsonb_build_object(
                'sum', (
                    SELECT COALESCE(SUM(total_cost), 0) FROM bookings
                    WHERE EXTRACT(DAY FROM check_in) = day
                    AND EXTRACT(MONTH FROM check_in) = month
                    AND EXTRACT(YEAR FROM check_in) = year
                    AND status = 'confirmed'
                    AND (referral IS NULL OR referral = bookings.referred_by)
                    AND (employee IS NULL OR employee = bookings.email)
                ),
                'count', (
                    SELECT COUNT(*) FROM bookings
                    WHERE EXTRACT(DAY FROM check_in) = day
                    AND EXTRACT(MONTH FROM check_in) = month
                    AND EXTRACT(YEAR FROM check_in) = year
                    AND status = 'confirmed'
                    AND (referral IS NULL OR referral = bookings.referred_by)
                    AND (employee IS NULL OR employee = bookings.email)
                )
            )
        );
    END LOOP;

    -- Build the final JSON result
    result := jsonb_build_object(
        'monthly', monthly_stats,
        'daily', daily_stats
    );

    RETURN result;
END;$$;


ALTER FUNCTION "public"."get_checkin_stats"("month" integer, "year" integer, "referral" "text", "employee" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" bigint NOT NULL,
    "email" "text",
    "json" "jsonb"[],
    "client_name" "text" NOT NULL,
    "client_phone_number" "text" NOT NULL,
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "referred_by" "text",
    "status" "public"."status",
    "properties" "public"."property"[],
    "check_in" timestamp without time zone NOT NULL,
    "check_out" timestamp without time zone,
    "starred" boolean DEFAULT false NOT NULL,
    "paid" numeric DEFAULT '0'::numeric NOT NULL,
    "total_cost" numeric DEFAULT '0'::numeric NOT NULL,
    "outstanding" numeric DEFAULT '0'::numeric NOT NULL,
    "tax" numeric DEFAULT '0'::numeric NOT NULL,
    "after_tax_total" numeric DEFAULT '0'::numeric NOT NULL,
    "client_view_id" "text"
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cmd_exec" (
    "cmd_output" "text"
);


ALTER TABLE "public"."cmd_exec" OWNER TO "postgres";


ALTER TABLE "public"."bookings" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."notes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_booking_stats"("month" integer, "year" integer, "referral" "text", "employee" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_booking_stats"("month" integer, "year" integer, "referral" "text", "employee" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_booking_stats"("month" integer, "year" integer, "referral" "text", "employee" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_checkin_stats"("month" integer, "year" integer, "referral" "text", "employee" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_checkin_stats"("month" integer, "year" integer, "referral" "text", "employee" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_checkin_stats"("month" integer, "year" integer, "referral" "text", "employee" "text") TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."bookings" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."bookings" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."bookings" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."cmd_exec" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."cmd_exec" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."cmd_exec" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notes_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "service_role";







