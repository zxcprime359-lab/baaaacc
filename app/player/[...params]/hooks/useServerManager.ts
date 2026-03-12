//ZXCSTREAM
import useSource from "@/hook/source";
import { useAnimation } from "motion/react";
import { RefObject, useEffect, useRef, useState } from "react";

export type ServerStatus =
  | "queue"
  | "checking"
  | "connecting"
  | "available"
  | "failed"
  | "cancelled";

export type ServerTypes = {
  name: string;
  server: number;
  status: ServerStatus;
  desc: string;
};
export function useServerManager({
  containerRef,
  media_type,
  id,
  season,
  episode,
  imdbId,
  title,
  year,
  defaultServer,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  media_type: string;
  id: number;
  season: number;
  episode: number;
  imdbId: string | null;
  title: string;
  year: string;
  defaultServer: number;
}) {
  const [servers, setServers] = useState<ServerTypes[]>([
    {
      name: "Icarus",
      server: 11,
      status: "queue",
      desc: "Vast Collection, Fast & Stable",
    },
    {
      name: "Atlas (NEW)",
      server: 22,
      status: "queue",
      desc: "4K Support, Fast & Stable, Multi Audio",
    },

    {
      name: "Daedalus I",
      server: 0,
      status: "queue",
      desc: "Multi Audio Support",
    },

    {
      name: "Thanatos II",
      server: 1,
      status: "queue",
      desc: "Alternative",
    },
    {
      name: "Aether III",
      server: 2,
      status: "queue",
      desc: "May contain 4k movies",
    },
    {
      name: "Orion IV",
      server: 3,
      status: "queue",
      desc: "Built-In Subtitle",
    },
    // {
    //   name: "Helios V",
    //   server: 4,
    //   status: "queue",
    //   desc: "",
    // },
    // {
    //   name: "Nyx VI",
    //   server: 5,
    //   status: "queue",
    //   desc: "",
    // },
    {
      name: "Echo VII",
      server: 6,
      status: "queue",
      desc: "",
    },
    {
      name: "Morpheus VIII",
      server: 7,
      status: "queue",
      desc: "Spanish Audio",
    },
    {
      name: "Talos IX",
      server: 8,
      status: "queue",
      desc: "Spanish Audio",
    },
    {
      name: "Hypnos X",
      server: 50,
      status: "queue",
      desc: "",
    },
    {
      name: "Kairos XI",
      server: 60,
      status: "queue",
      desc: "",
    },
  ]);

  const [serverIndex, setServerIndex] = useState(defaultServer);
  const [serversFailed, setAllServersFailed] = useState(false);
  const server = servers[serverIndex].server;
  const [playing, setPlaying] = useState(false);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const controls = useAnimation();

  const {
    data: source,
    isFetched,
    isError,
  } = useSource({
    media_type,
    id,
    season,
    episode,
    server,
    imdbId,
    title,
    year,
  });

  const updateServerStatus = (index: number, status: ServerTypes["status"]) =>
    setServers((prev) =>
      prev.map((s, i) => (i === index ? { ...s, status } : s)),
    );
  useEffect(() => {
    const current = servers[serverIndex];
    if (!current || current.status !== "failed") return;

    let nextIndex = servers.findIndex(
      (s) => s.status === "queue" || s.status === "cancelled",
    );

    if (nextIndex === -1) {
      nextIndex = servers.findIndex((s) => s.status === "available");
    }

    if (nextIndex === -1) {
      setAllServersFailed(true);
      console.log("All servers failed");
      return;
    }

    const timer = setTimeout(() => {
      setServerIndex(nextIndex);
    }, 500);

    return () => clearTimeout(timer);
  }, [servers, serverIndex]);

  useEffect(() => {
    if (!servers[serverIndex]) return;

    // Phase 1: status before validation
    if (!isFetched) {
      updateServerStatus(serverIndex, "checking");
      return;
    }

    if (isError || !source?.link) {
      updateServerStatus(serverIndex, "failed");
      return;
    }

    updateServerStatus(serverIndex, "connecting");

    // Phase 2: validate M3U8
    const checkM3U8 = async () => {
      try {
        const res = await fetch(source.link, { method: "HEAD" });

        updateServerStatus(serverIndex, res.ok ? "available" : "failed");

        // console.log(res.ok ? "M3U8 valid" : "M3U8 failed", source.link);
      } catch (err) {
        updateServerStatus(serverIndex, "failed");
        console.log("Error fetching M3U8 HEAD:", err);
      }
    };

    checkM3U8();
  }, [isFetched, isError, source?.link, serverIndex]);

  const handleSelectServer = (index: number) => {
    setAllServersFailed(false);
    setPlaying(false);
    setServers((prev) =>
      prev.map((s, i) => {
        if (
          (i === serverIndex && s.status === "checking") ||
          s.status === "connecting"
        ) {
          // Mark the current server as cancelled
          return { ...s, status: "cancelled" };
        }
        if (i === index) {
          return { ...s, status: "checking" };
        }
        return s;
      }),
    );
    setServerIndex(index);
  };
  const handleRefreshServers = () => {
    setServers((prev) => prev.map((s) => ({ ...s, status: "queue" })));
    setServerIndex(0);
    setAllServersFailed(false);
  };

  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is ready
    const timer = requestAnimationFrame(() => {
      const container = containerRef.current;
      const activeItem = itemRefs.current[serverIndex];
      if (!container || !activeItem) return;

      console.log("meow");
      const offset =
        activeItem.offsetTop +
        activeItem.offsetHeight / 2 -
        container.clientHeight / 2;
      console.log("offset", offset);

      controls.start({
        y: -offset,
        transition: { type: "spring", stiffness: 150, damping: 25 },
      });
    });

    return () => cancelAnimationFrame(timer);
  }, [serverIndex]);

  return {
    server,
    servers,
    serverIndex,
    source,
    serversFailed,
    controls,
    itemRefs,
    handleSelectServer,
    updateServerStatus,
    handleRefreshServers,
  };
}
