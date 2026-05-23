import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface PlaceSuggestion {
  place_id: string;
  description: string;
  structured_formatting: { main_text: string; secondary_text: string };
}

export interface ParsedAddress {
  street: string;
  city: string;
  state: string;
  postal: string;
  country: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (parsed: ParsedAddress) => void;
  autoFocus?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sessionRef = useRef<string>(crypto.randomUUID());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = (input: string) => {
    clearTimeout(debounceRef.current);
    if (input.length < 3) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setFetching(true);
      try {
        const res = await fetch(
          `/api/places/autocomplete?input=${encodeURIComponent(input)}&sessiontoken=${sessionRef.current}`,
          { credentials: "include" },
        );
        const data = await res.json();
        if (data.predictions) { setSuggestions(data.predictions.slice(0, 5)); setOpen(true); }
      } catch { }
      finally { setFetching(false); }
    }, 350);
  };

  const selectPlace = async (placeId: string, mainText: string) => {
    setOpen(false);
    onChange(mainText);
    try {
      const res = await fetch(
        `/api/places/details?place_id=${placeId}&sessiontoken=${sessionRef.current}`,
        { credentials: "include" },
      );
      const data = await res.json();
      sessionRef.current = crypto.randomUUID();
      const comps: { types: string[]; long_name: string }[] = data.result?.address_components ?? [];
      const get = (type: string) => comps.find((c) => c.types.includes(type))?.long_name ?? "";
      const street = [get("street_number"), get("route")].filter(Boolean).join(" ");
      onSelect({
        street: street || mainText,
        city: get("locality") || get("sublocality") || get("administrative_area_level_2"),
        state: get("administrative_area_level_1"),
        postal: get("postal_code"),
        country: get("country"),
      });
    } catch { }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          type="text"
          autoFocus={autoFocus}
          autoComplete="off"
          value={value}
          onChange={(e) => { onChange(e.target.value); fetchSuggestions(e.target.value); }}
          placeholder="Street address and number"
          className="rounded-xl h-11 bg-background border-border pr-8"
        />
        {fetching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); selectPlace(s.place_id, s.structured_formatting.main_text); }}
              className="w-full text-left px-3 py-2.5 hover:bg-violet-50 transition-colors border-b border-border/50 last:border-0"
            >
              <p className="text-sm font-medium text-foreground truncate">{s.structured_formatting.main_text}</p>
              <p className="text-xs text-muted-foreground truncate">{s.structured_formatting.secondary_text}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
