# Luma API Reference

Reverse-engineered from `https://luma.com` network traffic. All endpoints are public and require no authentication.

**Base URL:** `https://api2.luma.com`

---

## Table of Contents

1. [Bootstrap Page](#1-bootstrap-page)
2. [List Categories](#2-list-categories)
3. [Category Page Metadata](#3-category-page-metadata)
4. [Get Paginated Events — by City](#4-get-paginated-events--by-city)
5. [Get Paginated Events — by Category](#5-get-paginated-events--by-category)
6. [Calendar Events (Featured Calendars)](#6-calendar-events-featured-calendars)
7. [Place Metadata](#7-place-metadata)
8. [Place Calendars](#8-place-calendars)
9. [Pagination](#9-pagination)
10. [Reference Data — All Cities](#10-reference-data--all-cities)
11. [Reference Data — All Categories](#11-reference-data--all-categories)
12. [Reference Data — Featured Calendars](#12-reference-data--featured-calendars)
13. [Event Object Schema](#13-event-object-schema)

---

## 1. Bootstrap Page

Single call that returns all static discovery data: every city, all featured calendars, all categories.

```
GET https://api2.luma.com/discover/bootstrap-page
```

**No parameters.**

### Response structure

```json
{
  "places_by_continent": [...],
  "places": [...],
  "featured_place": null,
  "calendars": [...],
  "categories": [...],
  "debug_info": {...}
}
```

| Key | Description |
|-----|-------------|
| `places_by_continent` | Array of continent objects, each with a `places` array |
| `places` | Flat array of all 85 city/place objects |
| `featured_place` | Currently `null` |
| `calendars` | 9 featured calendar objects |
| `categories` | 8 category objects |
| `debug_info` | Internal metadata, not useful for scraping |

### Example — single place object (inside `places` array)

```json
{
  "place": {
    "api_id": "discplace-FC4SDMUVXiFtMOr",
    "name": "Amsterdam",
    "slug": "amsterdam",
    "geo_continent": "europe",
    "description": "In Amsterdam, the city's pulse is vibrant with tech and cultural gatherings...",
    "event_count": 23,
    "timezone": "Europe/Amsterdam",
    "tint_color": "#FF6B35",
    "coordinate": {
      "latitude": 52.3676,
      "longitude": 4.9041
    },
    "featured_event_api_ids": [
      "evt-GUgwFlqOLEEpqoa",
      "evt-W5stH62bNvCQB9H"
    ],
    "icon_url": "https://images.lumacdn.com/discovery/ams-icon.png",
    "hero_image_desktop_url": "...",
    "social_image_url": "...",
    "publication_name": "Popular events in Amsterdam",
    "is_launched": true
  },
  "num_events": 23,
  "event_count": 23,
  "is_subscriber": false,
  "distance_km": null
}
```

### Example — single calendar object (inside `calendars` array)

```json
{
  "is_subscriber": false,
  "is_admin": false,
  "membership_info": null,
  "calendar": {
    "api_id": "cal-iOipAs7mv59Hbuz",
    "name": "OpenClaw Meetups",
    "slug": "claw",
    "description_short": "Discover community meetups for OpenClaw around the world.",
    "access_level": "public",
    "avatar_url": "https://images.lumacdn.com/calendars/9k/5501eea1-5914-4a19-9658-305602cf7147.png",
    "cover_image_url": "https://images.lumacdn.com/calendar-cover-images/tr/e3e88858-4da4-475e-a60b-ef385fffdfda.png",
    "website": "https://openclaw.ai/",
    "twitter_handle": "openclaw",
    "linkedin_handle": null,
    "instagram_handle": null,
    "tint_color": "#6bb2c1",
    "luma_plan": "free",
    "luma_plus_active": false,
    "verified_at": "2026-02-09T18:10:45.762Z",
    "luma_featured_position": "04926114912938817",
    "is_personal": false
  }
}
```

### Example — single category object (inside `categories` array)

```json
{
  "api_id": "cat-ai",
  "category": {
    "api_id": "cat-ai",
    "name": "AI",
    "slug": "ai",
    "description": "Join a hackathon, learn about LLMs and prompt engineering, or connect with other AI practitioners.",
    "event_count": 3143,
    "subscriber_count": 59228,
    "page_title": "AI Events",
    "tint_color": "#dd7aa4",
    "icon_url": "https://images.lumacdn.com/discovery/ai-icon.png",
    "simple_icon_url": "https://images.lumacdn.com/discovery/ai-icon-simple.png",
    "hero_image_desktop_url": "https://images.lumacdn.com/discovery/ai-square.png",
    "social_image_url": "https://images.lumacdn.com/discovery/ai-social.png",
    "created_at": "2025-01-15T15:10:39.492Z"
  },
  "event_count": 3143,
  "num_upcoming_events": 3143,
  "subscriber_count": 59228,
  "is_subscriber": false
}
```

---

## 2. List Categories

Standalone endpoint that returns category metadata only.

```
GET https://api2.luma.com/discover/category/list-categories?pagination_limit=20
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pagination_limit` | integer | no | Max categories to return. Default appears to be all 8. |

### Example response

```json
{
  "categories": [
    {
      "api_id": "cat-tech",
      "name": "Tech",
      "slug": "tech",
      "description": "Join a hackathon, jam on product design, and meet fellow tinkerers in the industry of tomorrow.",
      "event_count": 4923,
      "subscriber_count": 31682,
      "tint_color": "#ebb102"
    },
    {
      "api_id": "cat-ai",
      "name": "AI",
      "slug": "ai",
      "description": "Join a hackathon, learn about LLMs and prompt engineering, or connect with other AI practitioners.",
      "event_count": 3143,
      "subscriber_count": 59227,
      "tint_color": "#dd7aa4"
    }
  ]
}
```

---

## 3. Category Page Metadata

Returns full metadata for a single category page, including hero images and social assets.

```
GET https://api2.luma.com/discover/category/get-page?slug=<category_slug>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `slug` | string | yes | Category slug: `ai`, `tech`, `food`, `arts`, `climate`, `fitness`, `wellness`, `crypto` |

### Example request

```
GET https://api2.luma.com/discover/category/get-page?slug=ai
```

---

## 4. Get Paginated Events — by City

The main events endpoint. Returns events for a specific city, sorted by score/relevance then date.

```
GET https://api2.luma.com/discover/get-paginated-events
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `discover_place_api_id` | string | yes | City ID from bootstrap-page, e.g. `discplace-FC4SDMUVXiFtMOr` |
| `pagination_limit` | integer | no | Events per page. Max observed: 25. |
| `pagination_cursor` | string | no | Cursor from previous response's `next_cursor`. Omit for first page. |

### Example request — first page

```
GET https://api2.luma.com/discover/get-paginated-events
  ?discover_place_api_id=discplace-FC4SDMUVXiFtMOr
  &pagination_limit=25
```

### Example request — next page

```
GET https://api2.luma.com/discover/get-paginated-events
  ?discover_place_api_id=discplace-FC4SDMUVXiFtMOr
  &pagination_limit=25
  &pagination_cursor=eyJzdiI6IjIwMjYtMDQtMDMgMTc6MDA6MDArMDAiLCJmYiI6ImV2dC1HVWd3RmxxT0xFRXBxb2EifQ
```

### Example response

```json
{
  "entries": [
    {
      "api_id": "evt-W5stH62bNvCQB9H",
      "event": {
        "api_id": "evt-W5stH62bNvCQB9H",
        "name": "AI, deeptech and robotics - founders & investors",
        "start_at": "2026-03-31T15:15:00.000Z",
        "end_at": "2026-03-31T19:00:00.000Z",
        "timezone": "Europe/Amsterdam",
        "url": "h8m81k51",
        "cover_url": "https://images.lumacdn.com/event-covers/g8/ee0a84f2-dc5f-4f12-b0d0-1dbfb4219f7c.png",
        "calendar_api_id": "cal-O9VLpAlarXKOuEJ",
        "event_type": "independent",
        "location_type": "offline",
        "visibility": "public",
        "geo_address_info": {
          "mode": "obfuscated",
          "city": "Amsterdam",
          "city_state": "Amsterdam, Noord-Holland",
          "sublocality": "Zuidas"
        },
        "geo_address_visibility": "guests-only",
        "coordinate": {
          "latitude": 52.3375,
          "longitude": 4.875
        },
        "hide_rsvp": true,
        "show_guest_list": false,
        "waitlist_enabled": true,
        "waitlist_status": "active"
      },
      "calendar": {
        "api_id": "cal-O9VLpAlarXKOuEJ",
        "name": "Bits & Pretzels Amsterdam",
        "slug": null,
        "avatar_url": "https://images.lumacdn.com/calendars/ud/25e9ac5a-24d3-4417-ad3a-99cbdedb0d7c.png",
        "description_short": "",
        "luma_plan": "free",
        "luma_plus_active": false,
        "verified_at": "2026-02-27T11:22:57.601Z",
        "tint_color": "#F8712B",
        "website": null,
        "twitter_handle": null,
        "linkedin_handle": null,
        "instagram_handle": null
      },
      "hosts": [
        {
          "api_id": "usr-Q2ObKjGoQfcvTW1",
          "name": "Jorrit Aafjes",
          "first_name": "Jorrit",
          "last_name": "Aafjes",
          "avatar_url": "https://images.lumacdn.com/avatars/8h/61edb3df-f24b-414d-974d-50dfd1a1fd37.jpg",
          "username": null,
          "bio_short": "",
          "website": null,
          "twitter_handle": null,
          "linkedin_handle": "/in/jorritaafjes",
          "instagram_handle": null,
          "tiktok_handle": null,
          "youtube_handle": "",
          "timezone": "Europe/Amsterdam",
          "is_verified": false,
          "last_online_at": "2026-03-30T15:27:19.898Z"
        },
        {
          "api_id": "usr-NvaF6c4V1D3lKdU",
          "name": "Parul Benien",
          "first_name": "Parul",
          "last_name": "Benien",
          "avatar_url": "https://images.lumacdn.com/avatars/g5/af48fa42-fffa-4d98-88b9-5a7a68bb46b0.jpg",
          "linkedin_handle": "/in/pbenien"
        }
      ],
      "ticket_info": {
        "is_free": false,
        "price": null,
        "max_price": null,
        "is_sold_out": true,
        "spots_remaining": 0,
        "is_near_capacity": false,
        "require_approval": true,
        "currency_info": null
      },
      "guest_count": 0,
      "ticket_count": 0,
      "featured_guests": [],
      "featured_city": {
        "api_id": "discplace-FC4SDMUVXiFtMOr",
        "name": "Amsterdam",
        "slug": "amsterdam"
      },
      "score": 0.08660130718954248,
      "query_score": 0,
      "cover_image": {
        "colors": ["#013797", "#fefae6", "#fadb09"],
        "palette": {
          "neutral": [
            { "color": "#013797", "percentage": 55.95 },
            { "color": "#fefae6", "percentage": 17.7 }
          ],
          "vibrant": [
            { "color": "#fadb09", "percentage": 0.7 }
          ]
        }
      }
    }
  ],
  "has_more": true,
  "next_cursor": "eyJzdiI6IjIwMjYtMDQtMDMgMTc6MDA6MDArMDAiLCJmYiI6ImV2dC1HVWd3RmxxT0xFRXBxb2EifQ"
}
```

---

## 5. Get Paginated Events — by Category

Same endpoint as city events but filtered by category slug. The browser sends the user's coordinates for geo-ranked results; coordinates are optional but affect ranking.

```
GET https://api2.luma.com/discover/get-paginated-events
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `slug` | string | yes | Category slug: `ai`, `tech`, `food`, `arts`, `climate`, `fitness`, `wellness`, `crypto` |
| `pagination_limit` | integer | no | Events per page. |
| `pagination_cursor` | string | no | Cursor for next page. |
| `latitude` | float | no | User latitude for geo-ranking. |
| `longitude` | float | no | User longitude for geo-ranking. |

### Example request

```
GET https://api2.luma.com/discover/get-paginated-events
  ?slug=ai
  &pagination_limit=25
  &latitude=52.3676
  &longitude=4.9041
```

### Response structure

Same as city events — `{ entries: [...], has_more: bool, next_cursor: string }`.

---

## 6. Calendar Events (Featured Calendars)

**Different endpoint** from the discover events. Used to fetch events belonging to a specific calendar (organizer).

```
GET https://api2.luma.com/calendar/get-items
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `calendar_api_id` | string | yes | Calendar ID from bootstrap-page `calendars` array, e.g. `cal-iOipAs7mv59Hbuz` |
| `pagination_limit` | integer | no | Events per page. Max observed: 20. |
| `period` | string | no | `future` to get upcoming events only. Omit for all. |
| `pagination_cursor` | string | no | Cursor for next page. |

### Example request — first page

```
GET https://api2.luma.com/calendar/get-items
  ?calendar_api_id=cal-iOipAs7mv59Hbuz
  &pagination_limit=20
  &period=future
```

### Example request — next page

```
GET https://api2.luma.com/calendar/get-items
  ?calendar_api_id=cal-iOipAs7mv59Hbuz
  &pagination_limit=20
  &period=future
  &pagination_cursor=eyJzdiI6IjIwMjYtMDMtMzFUMTA6MzA6MDAuMDAwWiIsImZiIjoiY2FsZXYtdkhJOEd0WFluU3ZYRno0In0
```

### Example response

```json
{
  "entries": [
    {
      "api_id": "calev-vHI8GtXYnSvXFz4",
      "event": {
        "api_id": "evt-SmwJFgGuftYyj4S",
        "name": "🦞 OpenClaw Lobster Cave with Nazaré Ventures, TON, Safe4 & Ogment",
        "start_at": "2026-03-30T13:00:00.000Z",
        "end_at": "2026-03-30T16:00:00.000Z",
        "timezone": "America/New_York",
        "url": "openclaw-lobster-cave-sf-mar-30",
        "cover_url": "https://images.lumacdn.com/event-covers/...",
        "location_type": "offline",
        "visibility": "public",
        "geo_address_info": {
          "city": "San Francisco",
          "country": "United States",
          "full_address": "450 Post St, San Francisco, CA 94102",
          "short_address": "450 Post St, San Francisco",
          "mode": "shown"
        },
        "coordinate": {
          "latitude": 37.7881,
          "longitude": -122.4098
        }
      },
      "hosts": [...],
      "ticket_info": {
        "is_free": true,
        "price": null,
        "is_sold_out": false,
        "spots_remaining": 42,
        "require_approval": false
      }
    }
  ],
  "has_more": true,
  "next_cursor": "eyJzdiI6IjIwMjYtMDMtMzFUMTA6MzA6MDAuMDAwWiIsImZiIjoiY2FsZXYtdkhJOEd0WFluU3ZYRno0In0"
}
```

> **Note:** Entry `api_id` here is `calev-...` (calendar event join record), while `event.api_id` is `evt-...` (the actual event). Use `event.api_id` for event-level operations.

---

## 7. Place Metadata

Returns metadata for a single city page.

```
GET https://api2.luma.com/discover/get-place-v2?discover_place_api_id=<id>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `discover_place_api_id` | string | yes | City ID, e.g. `discplace-FC4SDMUVXiFtMOr` |

### Example request

```
GET https://api2.luma.com/discover/get-place-v2
  ?discover_place_api_id=discplace-FC4SDMUVXiFtMOr
```

---

## 8. Place Calendars

Returns the list of calendars/organizers active in a given city.

```
GET https://api2.luma.com/discover/get-calendars?discover_place_api_id=<id>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `discover_place_api_id` | string | yes | City ID |

### Example request

```
GET https://api2.luma.com/discover/get-calendars
  ?discover_place_api_id=discplace-FC4SDMUVXiFtMOr
```

---

## 9. Pagination

All paginated endpoints share the same cursor-based system.

### How it works

1. Make first request **without** `pagination_cursor`.
2. If `has_more === true`, take the `next_cursor` value and pass it as `pagination_cursor` in the next request.
3. Repeat until `has_more === false`.

### Cursor format

The cursor is a **base64-encoded JSON** string:

```json
{"sv": "2026-04-03 17:00:00+00", "fb": "evt-GUgwFlqOLEEpqoa"}
```

| Field | Description |
|-------|-------------|
| `sv` | Sort value — the `start_at` timestamp of the last event on the current page |
| `fb` | Fallback — the `api_id` of the last event, used as a tiebreaker |

For `calendar/get-items`, the `fb` value is a `calev-...` ID, not an `evt-...` ID.

### Scraper loop (pseudocode)

```python
cursor = None
while True:
    params = {
        "discover_place_api_id": "discplace-FC4SDMUVXiFtMOr",
        "pagination_limit": 25,
    }
    if cursor:
        params["pagination_cursor"] = cursor

    data = requests.get("https://api2.luma.com/discover/get-paginated-events", params=params).json()

    for entry in data["entries"]:
        process(entry)

    if not data["has_more"]:
        break
    cursor = data["next_cursor"]
```

---

## 10. Reference Data — All Cities

### Europe (24 cities)

| City | `api_id` | `slug` |
|------|----------|--------|
| Amsterdam | `discplace-FC4SDMUVXiFtMOr` | `amsterdam` |
| Barcelona | `discplace-WcS4REeayDPXV4n` | `barcelona` |
| Berlin | `discplace-gCfX0s3E9Hgo3rG` | `berlin` |
| Brussels | `discplace-CMxOe3Mv06uUk7l` | `brussels` |
| Budapest | `discplace-zS3rBqHSdNGTSZB` | `budapest` |
| Copenhagen | `discplace-CmmHAjPdBSsqmJf` | `copenhagen` |
| Dublin | `discplace-ffI8KmAB4gC5LMC` | `dublin` |
| Geneva | `discplace-RnVxN1SH4HYTeqF` | `geneva` |
| Hamburg | `discplace-xZzD6rDcDK12oi7` | `hamburg` |
| Helsinki | `discplace-gEii5B2Ju5KKRNH` | `helsinki` |
| Istanbul | `discplace-0vKyo1D6kdT4ml6` | `istanbul` |
| Lausanne | `discplace-SmrXTBH5rgPvd1h` | `lausanne` |
| Lisbon | `discplace-mgGFFo5EDdyekyE` | `lisbon` |
| London | `discplace-QCcNk3HXowOR97j` | `london` |
| Madrid | `discplace-03jiEcS4mvwJuDa` | `madrid` |
| Milan | `discplace-9AyCYUvGH7xiqhh` | `milan` |
| Munich | `discplace-P00kEGGGHNLEYGe` | `munich` |
| Paris | `discplace-NdLrh1xJfeotJZC` | `paris` |
| Prague | `discplace-6xx9LRci5NFgdJ5` | `prague` |
| Rome | `discplace-CLGg2G8Q96daz0w` | `rome` |
| Stockholm | `discplace-e7EG0Ef6S2aQnvN` | `stockholm` |
| Vienna | `discplace-3YgdIjqj7Pveid3` | `vienna` |
| Warsaw | `discplace-PTcuEQVHuySJe8N` | `warsaw` |
| Zurich | `discplace-tSRc3NkTycobe0w` | `zurich` |

### North America (26 cities)

| City | `api_id` | `slug` |
|------|----------|--------|
| Atlanta | `discplace-C6hWuH5suHJIUqC` | `atlanta` |
| Austin | `discplace-0tPy8KGz3xMycnt` | `austin` |
| Boston | `discplace-VWeZ1zUvnawYHMj` | `boston` |
| Calgary | `discplace-7AxSBoZHQy3igIZ` | `calgary` |
| Chicago | `discplace-NdGm35qFD0vaXNF` | `chicago` |
| Dallas | `discplace-Ez9iuaZfs6AZDls` | `dallas` |
| Denver | `discplace-I94ZmQKKyVnCQKv` | `denver` |
| Houston | `discplace-aQeJaEtqg3shHZ1` | `houston` |
| Las Vegas | `discplace-RF9Yq9JDUxmcpTr` | `las-vegas` |
| Los Angeles | `discplace-OgfEAh5KgfMzise` | `la` |
| Mexico City | `discplace-ntiNB0E437TyRqt` | `mexico-city` |
| Miami | `discplace-fSrrRYurTwydAGK` | `miami` |
| Minneapolis | `discplace-IHi0OqR5c6t4Hb3` | `minneapolis` |
| Montréal | `discplace-CXKKcJmNkbj6ikW` | `montreal` |
| New York | `discplace-Izx1rQVSh8njYpP` | `nyc` |
| Philadelphia | `discplace-VGLZZfVwOKRD1Yd` | `philadelphia` |
| Phoenix | `discplace-Vk9M1gTb4AMVXuD` | `phoenix` |
| Portland | `discplace-HthnjGVBzGh90sQ` | `portland` |
| Salt Lake City | `discplace-gxZJbB572Ls8RRu` | `salt-lake-city` |
| San Diego | `discplace-MNBATdzid940kqJ` | `sd` |
| San Francisco | `discplace-BDj7GNbGlsF7Cka` | `sf` |
| Seattle | `discplace-FQ4E58PeBMHGTKK` | `seattle` |
| Toronto | `discplace-Cx3JMS6vXKAbhV5` | `toronto` |
| Vancouver | `discplace-4fa7ldlAkBTTivm` | `vancouver` |
| Washington DC | `discplace-AANPgOymN6bqFn8` | `dc` |
| Waterloo | `discplace-idpnif8MiNuyYI7` | `waterloo_ca` |

### Asia & Pacific (20 cities)

| City | `api_id` | `slug` |
|------|----------|--------|
| Auckland | `discplace-NvBaYaVTkHmsPVy` | `auckland` |
| Bangkok | `discplace-1bk5q2gBJbv7Ngw` | `bangkok` |
| Bengaluru | `discplace-G0tGUVYwl7T17Sb` | `bengaluru` |
| Brisbane | `discplace-SQBjjDiskwFZwtG` | `brisbane` |
| Dubai | `discplace-d3kg1aLIJ5ROF6S` | `dubai` |
| Ho Chi Minh City | `discplace-3ixpMOGpQaA4dWG` | `ho-chi-minh-city` |
| Hong Kong | `discplace-z9B5Guglh2WINA1` | `hongkong` |
| Honolulu | `discplace-Ce0yAAavKebPHcB` | `honolulu` |
| Jakarta | `discplace-D0vMN5ttALav9XP` | `jakarta` |
| Kuala Lumpur | `discplace-O15L1VZiYe0GYGm` | `kuala-lumpur` |
| Manila | `discplace-XeAvnK62YmCW54R` | `manila` |
| Melbourne | `discplace-DlA8FnyHTxhIkN2` | `melbourne` |
| Mumbai | `discplace-Q5hkYsjZs1ZDJcU` | `mumbai` |
| New Delhi | `discplace-CzipmKodUYN2Dfx` | `new-delhi` |
| Seoul | `discplace-eQieweHXBFCWbCj` | `seoul` |
| Singapore | `discplace-mUbtdfNjfWaLQ72` | `singapore` |
| Sydney | `discplace-TPdKGPI56hGfOdi` | `sydney` |
| Taipei | `discplace-fi7MDZq99wfKWfa` | `taipei` |
| Tel Aviv | `discplace-fHkSoyCyugTZSbr` | `tel-aviv` |
| Tokyo | `discplace-9H7asQEvWiv6DA9` | `tokyo` |

### South America (5 cities)

| City | `api_id` | `slug` |
|------|----------|--------|
| Bogotá | `discplace-Rac9aE9RdKypLVS` | `bogota` |
| Buenos Aires | `discplace-wX2J5xGwAJpznew` | `buenos-aires` |
| Medellín | `discplace-K11Mq0Pw6sbManZ` | `medellin` |
| Rio de Janeiro | `discplace-EWglyhh4fsHKo2F` | `rio` |
| São Paulo | `discplace-AQZnCu9wl4LmOIp` | `saopaulo` |

### Africa (3 cities)

| City | `api_id` | `slug` |
|------|----------|--------|
| Cape Town | `discplace-YBoSEMjeIijj03X` | `capetown` |
| Lagos | `discplace-ARF3ZNcu47bs56x` | `lagos` |
| Nairobi | `discplace-YSx1DPerjjIyq7M` | `nairobi` |

---

## 11. Reference Data — All Categories

| Name | `api_id` | `slug` | Events |
|------|----------|--------|--------|
| Tech | `cat-tech` | `tech` | 4,923 |
| AI | `cat-ai` | `ai` | 3,143 |
| Wellness | `cat-C1VaNLnt25w9t6c` | `wellness` | 2,516 |
| Food & Drink | `cat-fooddrink` | `food` | 2,458 |
| Fitness | `cat-0Km9ZnuBjFAjwFl` | `fitness` | 1,447 |
| Arts & Culture | `cat-AzVAf6VmE9JEre4` | `arts` | 1,526 |
| Climate | `cat-climate` | `climate` | 1,173 |
| Crypto | `cat-crypto` | `crypto` | 867 |

---

## 12. Reference Data — Featured Calendars

| Name | `api_id` | `slug` |
|------|----------|--------|
| OpenClaw Meetups | `cal-iOipAs7mv59Hbuz` | `claw` |
| Reading Rhythms Global | `cal-CDoX2WaI5IHD5xs` | `readingrhythms-global` |
| Build Club | `cal-yrYsEKDQ91hPMWy` | `buildercommunityanz` |
| South Park Commons | `cal-Ve0M7LoDOpdnF3z` | `southparkcommons-events` |
| Design Buddies | `cal-HImlOWziQ7yD36i` | `design` |
| ADPList | `cal-pQmj8Ve8XE45u8l` | `adplistcommunity` |
| Cursor Community | `cal-61Cv6COs4g9GKw7` | `cursorcommunity` |
| Google DeepMind | `cal-7Q5A70Bz5Idxopu` | `deepmind` |
| The AI Collective | `cal-E74MDlDKBaeAwXK` | `genai-collective` |

---

## 13. Event Object Schema

Full schema of a single event entry as returned by both `/discover/get-paginated-events` and `/calendar/get-items`.

```
entry
├── api_id                    string   "evt-..." or "calev-..." (use event.api_id)
├── event
│   ├── api_id                string   "evt-W5stH62bNvCQB9H"
│   ├── name                  string   "AI, deeptech and robotics - founders & investors"
│   ├── start_at              string   ISO 8601 UTC "2026-03-31T15:15:00.000Z"
│   ├── end_at                string   ISO 8601 UTC "2026-03-31T19:00:00.000Z"
│   ├── timezone              string   "Europe/Amsterdam"
│   ├── url                   string   slug — full URL: https://lu.ma/{url}
│   ├── cover_url             string   image URL
│   ├── calendar_api_id       string   owning calendar
│   ├── event_type            string   "independent"
│   ├── location_type         string   "offline" | "online"
│   ├── visibility            string   "public"
│   ├── hide_rsvp             bool
│   ├── show_guest_list       bool
│   ├── one_to_one            bool
│   ├── recurrence_id         string|null
│   ├── waitlist_enabled      bool
│   ├── waitlist_status       string   "active" | "disabled"
│   ├── geo_address_info
│   │   ├── mode              string   "shown" | "obfuscated"
│   │   ├── city              string   "Amsterdam"
│   │   ├── city_state        string   "Amsterdam, Noord-Holland"
│   │   ├── sublocality       string   "Zuidas"
│   │   ├── address           string   (only when mode=shown) "Danzigerkade 8"
│   │   ├── full_address      string   (only when mode=shown)
│   │   ├── short_address     string   (only when mode=shown)
│   │   ├── country           string   "Netherlands"
│   │   ├── country_code      string   "NL"
│   │   └── place_id          string   Google Maps place ID
│   ├── geo_address_visibility string  "public" | "guests-only"
│   └── coordinate
│       ├── latitude          float    52.3375
│       └── longitude         float    4.875
├── calendar
│   ├── api_id                string
│   ├── name                  string   "Bits & Pretzels Amsterdam"
│   ├── slug                  string|null
│   ├── avatar_url            string
│   ├── description_short     string
│   ├── luma_plan             string   "free" | "plus"
│   ├── luma_plus_active      bool
│   ├── verified_at           string|null  ISO 8601
│   ├── tint_color            string   hex color
│   ├── website               string|null
│   ├── twitter_handle        string|null
│   ├── linkedin_handle       string|null  e.g. "/company/example"
│   └── instagram_handle      string|null
├── hosts[]
│   ├── api_id                string   "usr-..."
│   ├── name                  string   "Jorrit Aafjes"
│   ├── first_name            string
│   ├── last_name             string
│   ├── avatar_url            string
│   ├── username              string|null
│   ├── bio_short             string
│   ├── website               string|null
│   ├── timezone              string
│   ├── is_verified           bool
│   ├── last_online_at        string   ISO 8601
│   ├── twitter_handle        string|null
│   ├── linkedin_handle       string|null  e.g. "/in/jorritaafjes"
│   │                                      → full URL: https://linkedin.com/in/jorritaafjes
│   ├── instagram_handle      string|null
│   ├── tiktok_handle         string|null
│   └── youtube_handle        string|null
├── ticket_info
│   ├── is_free               bool
│   ├── price
│   │   ├── cents             int      1750  (= €17.50)
│   │   ├── currency          string   "eur"
│   │   └── is_flexible       bool
│   ├── max_price             object|null
│   ├── is_sold_out           bool
│   ├── spots_remaining       int
│   ├── is_near_capacity      bool
│   ├── require_approval      bool
│   └── currency_info
│       ├── currency          string   "eur"
│       └── decimals          int      2
├── guest_count               int
├── ticket_count              int
├── featured_guests[]         array    (usually empty)
├── featured_city
│   ├── api_id                string   "discplace-FC4SDMUVXiFtMOr"
│   ├── name                  string   "Amsterdam"
│   └── slug                  string   "amsterdam"
├── cover_image
│   ├── colors[]              string[] dominant hex colors
│   └── palette
│       ├── neutral[]         { color, percentage }
│       └── vibrant[]         { color, percentage }
├── score                     float    relevance score
├── query_score               float
└── role                      null
```

### Building a host's LinkedIn URL

```python
host = entry["hosts"][0]
if host.get("linkedin_handle"):
    linkedin_url = "https://linkedin.com" + host["linkedin_handle"]
    # e.g. "https://linkedin.com/in/jorritaafjes"
```

### Building an event URL

```python
event_url = "https://lu.ma/" + entry["event"]["url"]
# e.g. "https://lu.ma/h8m81k51"
```

### Checking ticket price

```python
ticket = entry["ticket_info"]
if ticket["is_free"]:
    price_display = "Free"
elif ticket["price"]:
    amount = ticket["price"]["cents"] / 100
    currency = ticket["price"]["currency"].upper()
    price_display = f"{currency} {amount:.2f}"   # "EUR 17.50"
elif ticket["is_sold_out"]:
    price_display = "Sold Out"
```
