import { relations } from "drizzle-orm/relations";
import { listings, listingImages, tours, usersInAuth, profiles, favoriteListings } from "@/lib/schema";

export const listingImagesRelations = relations(listingImages, ({one}) => ({
	listing: one(listings, {
		fields: [listingImages.zpid],
		references: [listings.zpid]
	}),
}));

export const listingsRelations = relations(listings, ({many}) => ({
	listingImages: many(listingImages),
	tours: many(tours),
	favoriteListings: many(favoriteListings),
}));

export const toursRelations = relations(tours, ({one}) => ({
	listing: one(listings, {
		fields: [tours.listingId],
		references: [listings.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [tours.userId],
		references: [usersInAuth.id]
	}),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	tours: many(tours),
	profiles: many(profiles),
	favoriteListings: many(favoriteListings),
}));

export const profilesRelations = relations(profiles, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [profiles.id],
		references: [usersInAuth.id]
	}),
}));

export const favoriteListingsRelations = relations(favoriteListings, ({one}) => ({
	listing: one(listings, {
		fields: [favoriteListings.listingId],
		references: [listings.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [favoriteListings.userId],
		references: [usersInAuth.id]
	}),
}));