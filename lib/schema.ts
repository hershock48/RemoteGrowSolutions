/**
 * The tables, as one idempotent script. Shared by the store and the seed so
 * the two can never disagree about a column. Every record is a jsonb
 * document beside the few columns a range query needs; lib/types.ts is the
 * real schema.
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS facilities (id text PRIMARY KEY, slug text UNIQUE NOT NULL, created_at bigint NOT NULL, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS rooms (id text PRIMARY KEY, facility_id text NOT NULL, created_at bigint NOT NULL, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS cycles (id text PRIMARY KEY, facility_id text NOT NULL, room_id text NOT NULL, status text NOT NULL, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS checkins (id text PRIMARY KEY, facility_id text NOT NULL, room_id text NOT NULL, day text NOT NULL, at bigint NOT NULL, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS events (id text PRIMARY KEY, facility_id text NOT NULL, date text NOT NULL, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS call_notes (id text PRIMARY KEY, facility_id text NOT NULL, week_of text NOT NULL, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS reports (id text PRIMARY KEY, facility_id text NOT NULL, week_of text NOT NULL, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS inquiries (id text PRIMARY KEY, created_at bigint NOT NULL, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS task_ticks (id text PRIMARY KEY, facility_id text NOT NULL, room_id text NOT NULL, period text NOT NULL, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS sensor_series (id text PRIMARY KEY, facility_id text NOT NULL, room_id text NOT NULL, uploaded_at bigint NOT NULL, data jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS checkins_room_at ON checkins (room_id, at DESC);
CREATE INDEX IF NOT EXISTS checkins_facility_day ON checkins (facility_id, day);
CREATE INDEX IF NOT EXISTS events_facility_date ON events (facility_id, date);
`;

/** The local development store, so the seed and the server open the same one. */
export const DEV_DATA_DIR = ".data/rgs";
