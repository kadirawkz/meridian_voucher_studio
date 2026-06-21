# Voucher Template

Place the controlled Word template at [templates/voucher-template.docx](templates/voucher-template.docx).

The generator uses Docxtemplater tags. Tags must be exact field names, not sample values.

Use this:

```text
{hotelName}
{requisitionNo}
```

Avoid this:

```text
{Hotel name}
{REQ-0000}
{0}
```

## Common Top-Level Tags

```text
{voucherTypeLabel}
{pageNumber}
{date}
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

Prefer `{rateApplicableText}` in new templates. `{rateApplicable}` remains available for backward compatibility.

## Booking Table Loop

Use a Docxtemplater loop for the voucher content table:

```text
{#lineItems}
{requiredDateDisplay} | {roomCategory} | {basis} | {singleRooms} | {doubleRooms} | {twinRooms} | {tripleRooms} | {guideWithBasis} | {arrivingFor}
{/lineItems}
```

If your table separates guide name and basis into two columns, use `{guide}` and `{guideBasis}` instead of `{guideWithBasis}`.

## Conditional Sections

Keep voucher variants in one template and switch text with boolean sections:

```text
{#isReservation}
Reservation-specific wording
{/isReservation}

{#isAmendment}
Amendment-specific wording
{/isAmendment}
```

The matching flags are provided by `electron/main/lib/documentGenerator.ts`.

## Template Editing Notes

- Paste each tag in one run when possible.
- Word can split tags across styled text runs, but keeping tags plain and uninterrupted is safer.
- If you need a tag that is not listed here, check the generator before adding it to the template.
