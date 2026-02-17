import { pgTable, pgSchema, index, unique, uuid, text, varchar, numeric, integer, boolean, timestamp, geometry, jsonb, bigint, pgPolicy, doublePrecision, foreignKey, check, serial } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

/**
 * Minimal reference to Supabase's auth.users table.
 * Only the `id` column is defined here since we only need it for foreign key references.
 * Supabase manages this table -- do not use Drizzle migrations on it.
 */
const authSchema = pgSchema("auth");
export const usersInAuth = authSchema.table("users", {
	id: uuid().primaryKey().notNull(),
});



export const listingsDupe = pgTable("listings_dupe", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	zpid: text().notNull(),
	detailUrl: text("detail_url"),
	statusType: varchar("status_type", { length: 50 }),
	statusText: varchar("status_text", { length: 100 }),
	address: text(),
	addressStreet: text("address_street"),
	addressCity: varchar("address_city", { length: 100 }),
	addressState: varchar("address_state", { length: 2 }),
	addressZipcode: varchar("address_zipcode", { length: 10 }),
	price: numeric({ precision: 12, scale:  2 }),
	beds: numeric({ precision: 3, scale:  1 }),
	baths: numeric({ precision: 3, scale:  1 }),
	area: integer(),
	isFeatured: boolean("is_featured").default(false),
	isShowcase: boolean("is_showcase").default(false),
	latitude: numeric({ precision: 10, scale:  8 }),
	longitude: numeric({ precision: 11, scale:  8 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	isLive: boolean("is_live").default(true),
	hasExtraFeatures: boolean("has_extra_features").default(false),
	coordinates: geometry({ type: "point", srid: 4326 }),
	description: text(),
	yearBuilt: integer("year_built"),
	parkingSpaces: integer("parking_spaces"),
	hasAirConditioning: boolean("has_air_conditioning"),
	hasHeating: boolean("has_heating"),
	hasDishwasher: boolean("has_dishwasher"),
	hasWasherDryer: boolean("has_washer_dryer"),
	petsAllowed: boolean("pets_allowed"),
	amenities: jsonb(),
	petPolicy: jsonb("pet_policy"),
	broker: text(),
	taxAssessment: numeric("tax_assessment"),
	taxAnnualAmount: numeric("tax_annual_amount"),
	zestimate: numeric(),
	pricePerSquareFoot: numeric("price_per_square_foot"),
	favoriteCount: numeric("favorite_count"),
	pageViews: numeric("page_views"),
	daysOnMarket: numeric("days_on_market"),
	priceChange: numeric("price_change"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	priceChangeDate: bigint("price_change_date", { mode: "number" }),
	lotSize: numeric("lot_size"),
	agentInfo: text("agent_info"),
	propertyType: text("property_type"),
	hasDetails: boolean("has_details"),
}, (table) => [
	index("listings_dupe_coordinates_idx").using("gist", table.coordinates.asc().nullsLast().op("gist_geometry_ops_2d")),
	index("listings_dupe_zpid_idx").using("btree", table.zpid.asc().nullsLast().op("text_ops")),
	unique("listings_dupe_zpid_key").on(table.zpid),
	unique("listings_dupe_zpid_key1").on(table.zpid),
]);

export const places = pgTable("places", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().notNull(),
	category: text(),
	name: text(),
	brand: text(),
	lon: doublePrecision(),
	lat: doublePrecision(),
	checkDate: text("check_date"),
	"addr:city": text("addr:city"),
	"addr:housenumber": text("addr:housenumber"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	"addr:postcode": bigint("addr:postcode", { mode: "number" }),
	"addr:street": text("addr:street"),
	subcategory: text(),
	"addr:state": text("addr:state"),
	coordinates: text("coordinates"),
}, (table) => [
	index("places_coordinates_idx").using("gist", table.coordinates.asc().nullsLast().op("gist_geography_ops")),
	index("places_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
	pgPolicy("Enable read access for all users", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
]);

export const listings = pgTable("listings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	zpid: text().notNull(),
	detailUrl: text("detail_url"),
	statusType: varchar("status_type", { length: 50 }),
	statusText: varchar("status_text", { length: 100 }),
	address: text(),
	addressStreet: text("address_street"),
	addressCity: varchar("address_city", { length: 100 }),
	addressState: varchar("address_state", { length: 2 }),
	addressZipcode: varchar("address_zipcode", { length: 10 }),
	price: numeric({ precision: 12, scale:  2 }),
	beds: numeric({ precision: 3, scale:  1 }),
	baths: numeric({ precision: 3, scale:  1 }),
	area: integer(),
	isFeatured: boolean("is_featured").default(false),
	isShowcase: boolean("is_showcase").default(false),
	latitude: numeric({ precision: 10, scale:  8 }),
	longitude: numeric({ precision: 11, scale:  8 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	isLive: boolean("is_live").default(true),
	hasExtraFeatures: boolean("has_extra_features").default(false),
	coordinates: geometry({ type: "point", srid: 4326 }),
	description: text(),
	yearBuilt: integer("year_built"),
	parkingSpaces: integer("parking_spaces"),
	hasAirConditioning: boolean("has_air_conditioning"),
	hasHeating: boolean("has_heating"),
	hasDishwasher: boolean("has_dishwasher"),
	hasWasherDryer: boolean("has_washer_dryer"),
	petsAllowed: boolean("pets_allowed"),
	amenities: jsonb(),
	petPolicy: jsonb("pet_policy"),
	hasDetails: boolean("has_details").default(false).notNull(),
	rawJsonDetails: jsonb("raw_json_details"),
	crimeScore: doublePrecision("crime_score"),
	trafficScore: doublePrecision("traffic_score"),
	overallScore: doublePrecision("overall_score"),
}, (table) => [
	index("idx_listings_coordinates").using("gist", table.coordinates.asc().nullsLast().op("gist_geometry_ops_2d")),
	index("idx_listings_zpid").using("btree", table.zpid.asc().nullsLast().op("text_ops")),
	index("listings_baths_idx").using("btree", table.baths.asc().nullsLast().op("numeric_ops")),
	index("listings_beds_idx").using("btree", table.beds.asc().nullsLast().op("numeric_ops")),
	index("listings_coordinates_idx").using("gist", table.coordinates.asc().nullsLast().op("gist_geometry_ops_2d")),
	index("listings_latitude_longitude_idx").using("btree", table.latitude.asc().nullsLast().op("numeric_ops"), table.longitude.asc().nullsLast().op("numeric_ops")),
	index("listings_price_idx").using("btree", table.price.asc().nullsLast().op("numeric_ops")),
	unique("listings_zpid_unique").on(table.zpid),
	unique("listings_zpid_key").on(table.zpid),
	pgPolicy("Enable read access for all users", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
]);

export const cachedQueries = pgTable("cached_queries", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "cached_queries_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	query: text().notNull(),
	result: jsonb().notNull(),
});

export const listingImages = pgTable("listing_images", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	zpid: text().notNull(),
	imageUrl: text("image_url").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_listing_images_zpid").using("btree", table.zpid.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.zpid],
			foreignColumns: [listings.zpid],
			name: "listing_images_zpid_fkey"
		}).onDelete("cascade"),
	unique("listing_images_zpid_image_url_key").on(table.zpid, table.imageUrl),
	pgPolicy("Enable read access for all users", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
]);

export const spatialRefSys = pgTable("spatial_ref_sys", {
	srid: integer().notNull(),
	authName: varchar("auth_name", { length: 256 }),
	authSrid: integer("auth_srid"),
	srtext: varchar({ length: 2048 }),
	proj4Text: varchar({ length: 2048 }),
}, (table) => [
	check("spatial_ref_sys_srid_check", sql`(srid > 0) AND (srid <= 998999)`),
]);

export const crime = pgTable("crime", {
	analysisNeighborhood: text("analysis_neighborhood"),
	cadNumber: text("cad_number"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cnn: bigint({ mode: "number" }),
	dataAsOf: timestamp("data_as_of", { withTimezone: true, mode: 'string' }),
	dataLoadedAt: timestamp("data_loaded_at", { withTimezone: true, mode: 'string' }),
	filedOnline: text("filed_online"),
	incidentCategory: text("incident_category"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	incidentCode: bigint("incident_code", { mode: "number" }),
	incidentDate: timestamp("incident_date", { withTimezone: true, mode: 'string' }),
	incidentDatetime: timestamp("incident_datetime", { withTimezone: true, mode: 'string' }),
	incidentDayOfWeek: text("incident_day_of_week"),
	incidentDescription: text("incident_description"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	incidentId: bigint("incident_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	incidentNumber: bigint("incident_number", { mode: "number" }),
	incidentSubcategory: text("incident_subcategory"),
	incidentTime: text("incident_time"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	incidentYear: bigint("incident_year", { mode: "number" }),
	intersection: text(),
	latitude: doublePrecision(),
	longitude: doublePrecision(),
	point: text(),
	policeDistrict: text("police_district"),
	reportDatetime: timestamp("report_datetime", { withTimezone: true, mode: 'string' }),
	reportTypeCode: text("report_type_code"),
	reportTypeDescription: text("report_type_description"),
	resolution: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowId: bigint("row_id", { mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	supervisorDistrict: bigint("supervisor_district", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	supervisorDistrict2012: bigint("supervisor_district_2012", { mode: "number" }),
	geom: geometry({ type: "point", srid: 4326 }),
}, (table) => [
	index("idx_crime_geom").using("gist", table.geom.asc().nullsLast().op("gist_geometry_ops_2d")),
]);

export const tours = pgTable("tours", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "tours_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	userId: uuid("user_id").notNull(),
	listingId: uuid("listing_id").notNull(),
	message: text(),
}, (table) => [
	foreignKey({
			columns: [table.listingId],
			foreignColumns: [listings.id],
			name: "tours_listing_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInAuth.id],
			name: "tours_user_id_fkey"
		}),
	pgPolicy("Enable All for users based on user_id", { as: "permissive", for: "all", to: ["public"], using: sql`(( SELECT auth.uid() AS uid) = user_id)`, withCheck: sql`(( SELECT auth.uid() AS uid) = user_id)`  }),
]);

export const profiles = pgTable("profiles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	firstName: text("first_name"),
	lastName: text("last_name"),
	avatarUrl: text("avatar_url"),
	fullName: text("full_name"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.id],
			foreignColumns: [usersInAuth.id],
			name: "profiles_id_fkey"
		}),
	unique("profiles_id_key").on(table.id),
	pgPolicy("Enable insert for users based on id", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(( SELECT auth.uid() AS uid) = id)`  }),
	pgPolicy("Enable update for users based on id", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Enable users to view their own data only", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const traffic = pgTable("traffic", {
	classcode: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cnn: bigint({ mode: "number" }),
	street: text(),
	geometry: jsonb(),
	geom: geometry({ type: "geometry", srid: 4326 }),
}, (table) => [
	index("idx_traffic_geom").using("gist", table.geom.asc().nullsLast().op("gist_geometry_ops_2d")),
]);

export const groceryStores = pgTable("grocery_stores", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint("ID", { mode: "number" }),
	store: text("Store"),
	address: text("Address"),
	latitude: doublePrecision("Latitude"),
	longitude: doublePrecision("Longitude"),
});

export const oldBadNeighborhoods = pgTable("old_bad_neighborhoods (To be deleted)", {
	nhood: text(),
	theGeom: geometry("the_geom", { type: "multipolygon", srid: 4326 }),
});

export const scores = pgTable("scores", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "scores_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	latitude: doublePrecision().notNull(),
	longitude: doublePrecision().notNull(),
	intersectionName: text("intersection_name"),
	cnn: text(),
	crimeScore: doublePrecision("crime_score"),
	trafficScore: doublePrecision("traffic_score"),
	geom: geometry({ type: "point", srid: 4326 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_scores_geom").using("gist", table.geom.asc().nullsLast().op("gist_geometry_ops_2d")),
	index("idx_scores_lat_lng").using("btree", table.latitude.asc().nullsLast().op("float8_ops"), table.longitude.asc().nullsLast().op("float8_ops")),
	unique("scores_latitude_longitude_key").on(table.latitude, table.longitude),
]);

export const neighborhoods = pgTable("neighborhoods", {
	theGeom: geometry("the_geom", { type: "multipolygon", srid: 4326 }),
	link: text(),
	name: text(),
}, (table) => [
	pgPolicy("Enable read access for all users", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
]);

export const contactSubmissions = pgTable("contact_submissions", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "contact_submissions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text(),
	email: text(),
	message: text(),
}, (table) => [
	pgPolicy("Enable all commands for service role", { as: "permissive", for: "all", to: ["service_role"], using: sql`true` }),
]);

export const listingsImagesDupe = pgTable("listings_images_dupe", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	zpid: text().notNull(),
	imageUrl: text("image_url").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("listings_images_dupe_zpid_idx").using("btree", table.zpid.asc().nullsLast().op("text_ops")),
	unique("listings_images_dupe_zpid_image_url_key").on(table.zpid, table.imageUrl),
]);

export const listingImagesDupe = pgTable("listing_images_dupe", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	zpid: text().notNull(),
	imageUrl: text("image_url").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("listing_images_dupe_zpid_idx").using("btree", table.zpid.asc().nullsLast().op("text_ops")),
	unique("listing_images_dupe_zpid_image_url_key").on(table.zpid, table.imageUrl),
]);

export const favoriteListings = pgTable("favorite_listings", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "favorite_listings_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	userId: uuid("user_id").notNull(),
	listingId: uuid("listing_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.listingId],
			foreignColumns: [listings.id],
			name: "favorite_listings_listing_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInAuth.id],
			name: "favorite_listings_user_id_fkey"
		}),
	unique("unique_user_listing").on(table.userId, table.listingId),
	pgPolicy("Enable all permissions for users based on user_id", { as: "permissive", for: "all", to: ["public"], using: sql`(( SELECT auth.uid() AS uid) = user_id)`, withCheck: sql`(( SELECT auth.uid() AS uid) = user_id)`  }),
]);

export const properties = pgTable("properties", {
	id: serial().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	zpid: bigint({ mode: "number" }).notNull(),
	streetAddress: text("street_address"),
	city: text(),
	state: text(),
	zipcode: text(),
	neighborhood: text(),
	homeStatus: text("home_status"),
	price: numeric(),
	bedrooms: numeric(),
	bathrooms: numeric(),
	propertyTypeDimension: text("property_type_dimension"),
	isListedByOwner: boolean("is_listed_by_owner"),
	daysOnZillow: integer("days_on_zillow"),
	description: text(),
	address: jsonb(),
	rentalAvailableTourTimes: jsonb("rental_available_tour_times"),
	rentalApplicationsAcceptedType: text("rental_applications_accepted_type"),
	homeInsights: jsonb("home_insights"),
	priceHistory: jsonb("price_history"),
	resoFacts: jsonb("reso_facts"),
	attributionInfo: jsonb("attribution_info"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_properties_description").using("gin", sql`to_tsvector('english'::regconfig, description)`),
	index("idx_properties_zpid").using("btree", table.zpid.asc().nullsLast().op("int8_ops")),
	unique("properties_zpid_key").on(table.zpid),
]);