export function UnsafeBanner() {
  return (
    <p className="unsafe-banner" role="alert">
      <strong>No route is safe at this departure.</strong> Even the recommended route has Severe
      or No Travel stretches — consider delaying. Use the time slider to see when conditions
      clear.
    </p>
  );
}
