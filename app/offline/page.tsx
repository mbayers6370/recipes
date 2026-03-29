export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "rgb(var(--warm-50))",
      }}
    >
      <section
        className="recipe-copy"
        style={{
          width: "100%",
          maxWidth: "440px",
          padding: "32px 24px",
          borderRadius: "24px",
          border: "1px solid rgba(var(--warm-300), 0.45)",
          background: "rgba(255, 255, 255, 0.72)",
          textAlign: "center",
        }}
      >
        <p
          style={{
            marginBottom: "12px",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: "rgb(var(--terra-500))",
          }}
        >
          ab ovo
        </p>
        <h1
          style={{
            marginBottom: "12px",
            fontSize: "32px",
            lineHeight: 1.05,
            color: "rgb(var(--warm-900))",
          }}
        >
          You&apos;re offline
        </h1>
        <p
          style={{
            fontSize: "15px",
            color: "rgb(var(--warm-600))",
          }}
        >
          Previously opened pages can still work from cache. Reconnect to sync
          recipes, meal plans, and grocery changes.
        </p>
      </section>
    </main>
  );
}
