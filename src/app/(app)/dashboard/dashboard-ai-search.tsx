"use client";

import {
  CheckCircle2,
  CornerDownLeft,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import type { PublicConversationAction } from "@/lib/ai/action-registry/types";
import {
  createOwnNotificationAction,
  markAllNotificationsReadAction,
} from "@/modules/notifications/actions";

const suggestions = [
  "Ir a clientes",
  "Nuevo producto",
  "Crear tarea llamar proveedor",
  "Marcar notificaciones leidas",
];

export type DashboardAiSearchCapabilities = {
  canCreateCustomer: boolean;
  canCreateProduct: boolean;
  canCreateQuote: boolean;
  showAdmin: boolean;
  showAgenda: boolean;
  showAutoblog: boolean;
  showBilling: boolean;
  showBrain: boolean;
  showCatalog: boolean;
  showCrm: boolean;
  showDispatch: boolean;
  showHr: boolean;
  showInbox: boolean;
  showInventory: boolean;
  showPayments: boolean;
  showPurchases: boolean;
  showQuotes: boolean;
  showSales: boolean;
};

type RouteCommand = {
  href: string;
  keywords: string[];
  label: string;
  visible: boolean;
};

type CommandResult = {
  message: string;
  status: "error" | "success";
} | null;

type BrainApiResult = {
  actionId?: string;
  actionName?: string;
  confirmationRequired?: boolean;
  error?: string;
  message?: string;
  mode?: string;
  result?: Record<string, unknown>;
  token?: string;
};

function normalizeCommand(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildRouteCommands(
  capabilities: DashboardAiSearchCapabilities,
): RouteCommand[] {
  return [
    {
      href: "/dashboard",
      keywords: ["inicio", "dashboard", "resumen", "reportes"],
      label: "Abrir resumen del negocio",
      visible: true,
    },
    {
      href: "/crm/clientes",
      keywords: ["crm", "clientes", "lista de clientes", "buscar cliente"],
      label: "Abrir clientes",
      visible: capabilities.showCrm,
    },
    {
      href: "/crm/clientes/nuevo",
      keywords: ["nuevo cliente", "crear cliente", "agregar cliente"],
      label: "Crear cliente",
      visible: capabilities.showCrm && capabilities.canCreateCustomer,
    },
    {
      href: "/cotizaciones",
      keywords: ["cotizaciones", "ver cotizaciones", "presupuestos"],
      label: "Abrir cotizaciones",
      visible: capabilities.showQuotes,
    },
    {
      href: "/cotizaciones/nueva",
      keywords: ["nueva cotizacion", "crear cotizacion", "hacer cotizacion"],
      label: "Crear cotizacion",
      visible: capabilities.showQuotes && capabilities.canCreateQuote,
    },
    {
      href: "/ventas",
      keywords: ["ventas", "pedidos", "ordenes de venta"],
      label: "Abrir ventas",
      visible: capabilities.showSales,
    },
    {
      href: "/catalogo/productos",
      keywords: ["catalogo", "productos", "lista de productos"],
      label: "Abrir productos",
      visible: capabilities.showCatalog,
    },
    {
      href: "/catalogo/productos/nuevo",
      keywords: ["nuevo producto", "crear producto", "agregar producto"],
      label: "Crear producto",
      visible: capabilities.showCatalog && capabilities.canCreateProduct,
    },
    {
      href: "/inventario",
      keywords: ["inventario", "stock", "existencias", "bajo stock"],
      label: "Abrir inventario",
      visible: capabilities.showInventory,
    },
    {
      href: "/compras",
      keywords: ["compras", "ordenes de compra", "proveedores"],
      label: "Abrir compras",
      visible: capabilities.showPurchases,
    },
    {
      href: "/pagos",
      keywords: ["pagos", "cuentas por cobrar", "cuentas por pagar", "cobros"],
      label: "Abrir pagos",
      visible: capabilities.showPayments,
    },
    {
      href: "/facturacion/documentos",
      keywords: ["facturacion", "facturas", "documentos fiscales"],
      label: "Abrir facturacion",
      visible: capabilities.showBilling,
    },
    {
      href: "/agenda",
      keywords: ["agenda", "seguimientos", "tareas", "pendientes"],
      label: "Abrir agenda",
      visible: capabilities.showAgenda,
    },
    {
      href: "/despacho",
      keywords: ["despacho", "entregas", "logistica"],
      label: "Abrir despacho",
      visible: capabilities.showDispatch,
    },
    {
      href: "/whapp/conversaciones",
      keywords: ["whatsapp", "inbox", "mensajes", "conversaciones"],
      label: "Abrir inbox",
      visible: capabilities.showInbox,
    },
    {
      href: "/brain",
      keywords: ["brain", "inteligencia negocio"],
      label: "Abrir Brain",
      visible: capabilities.showBrain,
    },
    {
      href: "/autoblog",
      keywords: ["autoblog", "blog", "articulos"],
      label: "Abrir Autoblog",
      visible: capabilities.showAutoblog,
    },
    {
      href: "/rrhh/personal",
      keywords: ["rrhh", "recursos humanos", "personal", "planillas"],
      label: "Abrir RRHH",
      visible: capabilities.showHr,
    },
    {
      href: "/admin",
      keywords: ["admin", "configuracion", "ajustes"],
      label: "Abrir configuracion",
      visible: capabilities.showAdmin,
    },
    {
      href: "/admin/ia",
      keywords: ["configurar ia", "ajustes ia", "admin ia"],
      label: "Abrir ajustes IA",
      visible: capabilities.showAdmin,
    },
  ];
}

function getTaskTitle(command: string) {
  return command
    .replace(
      /^(crear|agregar|anotar|guardar|registrar)\s+(una\s+)?(tarea|nota|recordatorio)\s*/i,
      "",
    )
    .replace(/^recordarme\s*/i, "")
    .trim();
}

export function DashboardAiSearch(capabilities: DashboardAiSearchCapabilities) {
  const pathname = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [brainActions, setBrainActions] = useState<
    PublicConversationAction[]
  >([]);
  const [command, setCommand] = useState("");
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);
  const [result, setResult] = useState<CommandResult>(null);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [visibleText, setVisibleText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const currentSuggestion = useMemo(
    () => suggestions[suggestionIndex % suggestions.length],
    [suggestionIndex],
  );
  const routeCommands = useMemo(
    () => buildRouteCommands(capabilities),
    [capabilities],
  );
  const visibleRouteCommands = useMemo(
    () => routeCommands.filter((item) => item.visible).slice(0, 6),
    [routeCommands],
  );
  const visibleActionCommands = useMemo(() => {
    const normalized = normalizeCommand(command);
    if (!normalized) return [];
    const words = normalized.split(" ").filter((word) => word.length > 2);
    const contextualActionIds = pathname.includes("/catalogo")
      ? ["productos.buscar_producto", "productos.crear_producto"]
      : pathname.includes("/crm")
        ? ["clientes.buscar_cliente", "clientes.crear_cliente"]
        : pathname.includes("/inventario")
          ? ["inventario.consultar_stock"]
          : [];

    return brainActions
      .filter((action) => {
        const searchable = normalizeCommand(
          [action.name, action.id, ...action.aliases].join(" "),
        );
        return (
          contextualActionIds.includes(action.id) ||
          searchable.includes(normalized) ||
          words.some((word) => searchable.includes(word))
        );
      })
      .slice(0, 4);
  }, [brainActions, command, pathname]);
  const showCommandMenu = false;

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.ctrlKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    let active = true;

    fetch("/api/brain/actions")
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        setBrainActions(Array.isArray(data.actions) ? data.actions : []);
      })
      .catch(() => {
        if (active) setBrainActions([]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const doneTyping = !isDeleting && visibleText === currentSuggestion;
    const doneDeleting = isDeleting && visibleText.length === 0;
    const timeout = window.setTimeout(
      () => {
        if (doneTyping) {
          setIsDeleting(true);
          return;
        }

        if (doneDeleting) {
          setIsDeleting(false);
          setSuggestionIndex((current) => current + 1);
          return;
        }

        setVisibleText((current) =>
          isDeleting
            ? current.slice(0, -1)
            : currentSuggestion.slice(0, current.length + 1),
        );
      },
      doneTyping ? 1400 : isDeleting ? 34 : 58,
    );

    return () => window.clearTimeout(timeout);
  }, [currentSuggestion, isDeleting, visibleText]);

  function navigateTo(href: string, message?: string) {
    router.push(href);
    setCommand("");
    setConfirmationToken(null);
    setResult({ message: message ?? "Abriendo modulo...", status: "success" });
  }

  function findExactRoute(normalized: string) {
    return routeCommands.find(
      (item) =>
        item.visible &&
        item.keywords.some((keyword) => {
          const normalizedKeyword = normalizeCommand(keyword);
          return (
            normalized === normalizedKeyword ||
            normalized === `abrir ${normalizedKeyword}` ||
            normalized === `ir a ${normalizedKeyword}`
          );
        }),
    );
  }

  async function runBrainCommand(rawCommand: string) {
    setResult({ message: "Interpretando con Brain...", status: "success" });

    const response = await fetch("/api/brain/execute", {
      body: JSON.stringify({
        context: {
          channel: "internal_user",
          currentPath: pathname,
          currentModule: pathname.split("/").filter(Boolean)[0] ?? "dashboard",
        },
        message: rawCommand,
        source: "global_command_bar",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = (await response.json()) as BrainApiResult;

    if (!response.ok) {
      const message = data.error?.includes("configuracion de ia esta desactivada")
        ? "Puedo hacer busquedas y acciones simples sin IA. Para pedidos mas abiertos, activa el Brain en IA."
        : data.error;

      setResult({
        message:
          message ??
          "No encontre una accion del Brain para eso. Prueba con crear tarea, nuevo producto, clientes o notificaciones leidas.",
        status: "error",
      });
      return;
    }

    if (data.confirmationRequired && data.token) {
      setConfirmationToken(data.token);
      setCommand("");
      setResult({
        message: `${data.message ?? "Esta accion requiere confirmacion."} Responde "si" para continuar.`,
        status: "success",
      });
      window.setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }

    setConfirmationToken(null);
    setCommand("");
    router.refresh();
    setResult({
      message: data.message ?? "Accion ejecutada correctamente.",
      status: "success",
    });
  }

  async function confirmBrainCommand() {
    if (!confirmationToken) return;

    setResult({ message: "Ejecutando...", status: "success" });

    const response = await fetch("/api/brain/confirm", {
      body: JSON.stringify({ confirmationToken }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = (await response.json()) as BrainApiResult;

    setConfirmationToken(null);
    setCommand("");
    if (response.ok) router.refresh();
    setResult({
      message: response.ok
        ? data.message ?? "Accion confirmada correctamente."
        : data.error ?? "No se pudo confirmar la accion.",
      status: response.ok ? "success" : "error",
    });
  }

  function runCommand(rawCommand: string) {
    const normalized = normalizeCommand(rawCommand);

    if (!normalized) {
      setResult({
        message: "Escribe una tarea simple o modulo.",
        status: "error",
      });
      return;
    }

    if (
      confirmationToken &&
      ["si", "sí", "confirmar", "confirmo", "adelante", "ok"].includes(
        normalized,
      )
    ) {
      startTransition(async () => {
        await confirmBrainCommand();
      });
      return;
    }

    const wantsTask =
      normalized.startsWith("recordarme ") ||
      normalized.includes("crear tarea") ||
      normalized.includes("agregar tarea") ||
      normalized.includes("crear recordatorio") ||
      normalized.includes("agregar recordatorio");

    if (wantsTask) {
      const title = getTaskTitle(rawCommand) || "Tarea rapida";

      startTransition(async () => {
        const response = await createOwnNotificationAction({
          href: capabilities.showAgenda ? "/agenda/seguimientos" : "/dashboard",
          message: "Creada desde la barra IA.",
          metadata: { source: "dashboard_ai_search" },
          title,
          type: "task",
        });

        setResult({
          message: response.ok
            ? `Tarea creada: ${title}`
            : "No se pudo crear la tarea.",
          status: response.ok ? "success" : "error",
        });

        if (response.ok) setCommand("");
      });
      return;
    }

    if (
      normalized.includes("marcar notificaciones") ||
      normalized.includes("notificaciones leidas") ||
      normalized.includes("limpiar notificaciones")
    ) {
      startTransition(async () => {
        const response = await markAllNotificationsReadAction();

        setResult({
          message: response.ok
            ? "Notificaciones marcadas como leidas."
            : "No se pudieron marcar las notificaciones.",
          status: response.ok ? "success" : "error",
        });

        if (response.ok) setCommand("");
      });
      return;
    }

    const route = findExactRoute(normalized);

    if (route) {
      navigateTo(route.href, route.label);
      return;
    }

    startTransition(async () => {
      await runBrainCommand(rawCommand);
    });
  }

  return (
    <div className="dashboard-ai-command">
      <form
        className="dashboard-ai-search"
        onSubmit={(event) => {
          event.preventDefault();
          runCommand(command);
        }}
      >
        <Sparkles aria-hidden="true" size={24} />
        <label className="sr-only" htmlFor="dashboard-ai-input">
          Asistente IA
        </label>
        <input
          autoComplete="off"
          id="dashboard-ai-input"
          name="dashboard-ai-input"
          onChange={(event) => {
            setCommand(event.target.value);
            setResult(null);
          }}
          placeholder={visibleText || "Que necesitas hoy?"}
          ref={inputRef}
          type="text"
          value={command}
        />
        <kbd>Ctrl K</kbd>
        <button aria-label="Ejecutar comando" disabled={isPending} type="submit">
          {isPending ? (
            <Loader2
              aria-hidden="true"
              className="dashboard-ai-spin"
              size={18}
            />
          ) : (
            <Send aria-hidden="true" size={18} />
          )}
        </button>
      </form>

      {result ? (
        <p className="dashboard-ai-result" data-status={result.status}>
          {result.status === "success" ? (
            <CheckCircle2 aria-hidden="true" size={14} />
          ) : null}
          {result.message}
        </p>
      ) : null}

      {showCommandMenu && command.trim().length > 0 ? (
        <div className="dashboard-ai-command-menu" role="listbox">
          {visibleActionCommands.map((item) => (
            <button
              key={item.id}
              onClick={() => setCommand(item.aliases[0] ?? item.name)}
              type="button"
            >
              <span>{item.name}</span>
              <CornerDownLeft aria-hidden="true" size={14} />
            </button>
          ))}
          {visibleRouteCommands.map((item) => (
            <button
              key={item.href}
              onClick={() => navigateTo(item.href, item.label)}
              type="button"
            >
              <span>{item.label}</span>
              <CornerDownLeft aria-hidden="true" size={14} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
