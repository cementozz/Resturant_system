# Physical printer acceptance

Automated tests simulate the ESC/POS transport and exercise receipt/ticket rendering, routing, additions, refunds, drawer commands and failure isolation. No physical thermal printer is certified by these tests.

Record printer model/firmware, connection, Windows driver, paper width and operator for each trial:

- [ ] Arabic shaping and mixed Arabic/English text in image mode.
- [ ] Customer receipt at 58 mm and 80 mm, totals and long notes readable.
- [ ] Grill, fryer and drinks receive only the correct station items.
- [ ] Item modifiers, item notes and order notes print correctly.
- [ ] Addition and cancellation tickets are clearly marked.
- [ ] Original archived receipt stays unchanged after a menu price edit.
- [ ] Reprints are marked; copies and station selection are correct.
- [ ] Windows spooler and ESC/POS network handoff on actual devices.
- [ ] Cash drawer pulses only for the configured cash workflow.
- [ ] Paper-out, disconnected cable and unreachable printer produce retryable failures without undoing a sale.
- [ ] Local printing, cash sales and shift closing work without internet.

Keep signed results with the restaurant installation record before declaring hardware acceptance.
