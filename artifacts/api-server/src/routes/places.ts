import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/places/autocomplete", async (req, res): Promise<void> => {
  const { input, sessiontoken } = req.query as Record<string, string>;
  if (!input || input.trim().length < 2) {
    res.status(400).json({ error: "input required" });
    return;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Maps API not configured" });
    return;
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", input);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("types", "address");
  if (sessiontoken) url.searchParams.set("sessiontoken", sessiontoken);

  const resp = await fetch(url.toString());
  const data = await resp.json();
  res.json(data);
});

router.get("/places/details", async (req, res): Promise<void> => {
  const { place_id, sessiontoken } = req.query as Record<string, string>;
  if (!place_id) {
    res.status(400).json({ error: "place_id required" });
    return;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Maps API not configured" });
    return;
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", place_id);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("fields", "address_components,formatted_address");
  if (sessiontoken) url.searchParams.set("sessiontoken", sessiontoken);

  const resp = await fetch(url.toString());
  const data = await resp.json();
  res.json(data);
});

export default router;
