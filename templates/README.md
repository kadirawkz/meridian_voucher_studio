# Voucher Template

Place the controlled Word template at:

```text
templates/voucher-template.docx
```

The generator uses Docxtemplater tags. Tags must be field names, not example values.

Do this:

```text
{hotelName}
{requisitionNo}
```

Do not do this:

```text
{Hotel name}
{REQ-0000}
{0}
```

Recommended top-level tags:

```text
{voucherTypeLabel}
{pageNumber}
{date}
{voucherTypeLabel}
{hotelName}
{requisitionNo}
{tourNo}
{tourName}
{customerName}
{confirmedBy}
{rateApplicable}
{rateApplicableText}
{employeeName}
{employeeEmail}
{remarks}
{totalRooms}
{generatedAt}
```

For the voucher content table, add a Docxtemplater loop in the Word table:

```text
{#lineItems}
{requiredDateDisplay} | {roomCategory} | {basis} | {singleRooms} | {doubleRooms} | {twinRooms} | {tripleRooms} | {guide} | {guideBasis} | {arrivingFor}
{/lineItems}
```

If the template has one combined Guide column, use `{guideWithBasis}` instead of separate `{guide}` and `{guideBasis}` tags. It renders values like `1 (HB)`.

In Word, type each tag in one continuous action if possible. If Word splits a tag into multiple styled runs, Docxtemplater can usually handle it, but heavily edited tags are easier to break. The safest method is to paste the complete tag as plain text.

Keep all voucher variants in this one template. Use conditional sections such as:

```text
{#isReservation}
Reservation-specific wording
{/isReservation}
```

Add the matching boolean fields in `electron/main/lib/documentGenerator.ts` if the final template needs conditional text.

Notes:

- `{rateApplicable}` resolves to computed rate text for backward compatibility.
- Prefer `{rateApplicableText}` in new templates.
