import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import crypto from "crypto";
export interface SourceTypes {
  success: boolean;
  link: string;
  type: string;
}

export default function useSource({
  media_type,
  id,
  season,
  episode,
  imdbId,
  server = 1,
  title,
  year,
}: {
  media_type: string;
  id: number;
  season: number;
  episode: number;
  imdbId: string | null;
  server: number;
  title: string;
  year: string;
}) {
  const query = useQuery<SourceTypes>({
    queryKey: [
      "get-source",
      id,
      media_type,
      season,
      episode,
      imdbId,
      server,
      title,
      year,
    ],
    enabled: !!id && !!imdbId,
    queryFn: async () => {
      if ([0, 1, 11, 22, 2, 3, 4, 5, 6, 7].includes(server)) {
        const { f_token, f_ts } = generateFrontendToken(String(id));

        const tokenRes = await axios.post("/api/token", {
          idd: id,
          f_token,
          ts: f_ts,
        });
        const { ts, token } = tokenRes.data;

        const res = await axios.get(
          `/api/${server}?a=${id}&b=${media_type}${
            media_type === "tv" ? `&c=${season}&d=${episode}` : ""
          }${
            imdbId !== null ? `&e=${imdbId}` : ""
          }&gago=${ts}&putangnamo=${token}&f_token=${f_token}&f=${title}&g=${year}`,
        );

        return res.data;
      } else if (server === 50) {
        const url =
          media_type === "tv"
            ? `https://play.xpass.top/mov/${id}/${season}/${episode}/0/playlist.json`
            : `https://play.xpass.top/mov/${id}/0/0/0/playlist.json`;

        const res = await axios.get(url);
        const lastSource = res.data.playlist.at(-1);
        const finalSource = lastSource.sources.at(-1);

        const structure = {
          type: finalSource.type,
          link: finalSource.file,
          success: true,
        };
        return structure;
      } else if (server === 60) {
        const url =
          media_type === "tv"
            ? `https://play.xpass.top/meg/tv/${id}/${season}/${episode}/playlist.json`
            : `https://play.xpass.top/meg/movie/${id}/0/0/playlist.json`;

        const res = await axios.get(url);
        const lastSource = res.data.playlist.at(-1);
        const finalSource = lastSource.sources.at(-1);

        const structure = {
          type: finalSource.type,
          link: finalSource.file,
          success: true,
        };
        return structure;
      } else if (server === 70) {
        const url =
          media_type === "tv"
            ? `https://play.xpass.top/box/tv/${id}/${season}/${episode}/playlist.json`
            : `https://play.xpass.top/box/movie/${id}/0/0/playlist.json`;

        const res = await axios.get(url);
        const lastSource = res.data.playlist.at(-1);
        const finalSource = lastSource.sources.at(-1);

        const structure = {
          type: finalSource.type,
          link: finalSource.file,
          success: true,
        };
        return structure;
      }
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  return query;
}

export function generateFrontendToken(id: string) {
  const f_ts = Date.now();
  const f_token = crypto
    .createHash("sha256")
    .update(`${id}:${f_ts}`)
    .digest("hex");
  return { f_token, f_ts };
}
// https://fmovies4u.com/api/movie/353081
