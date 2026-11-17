# Master Prompt: Happy Skin Salon System Changes Manuscript

Copy and use the prompt below to prepare a project document, technical manuscript, or system documentation based on the Happy Skin Salon Management System and the changes in this repository.

---

## Prompt

Act as a technical writer and systems analyst. Prepare a clear, evidence-based manuscript documenting the implemented changes to the **Happy Skin Nails Spa & Aesthetic x He & She Salon Centralized Salon Management System**.

### Project context

The system is a multi-branch salon management application with:

- **Frontend:** React.js and Tailwind CSS
- **Backend:** FastAPI and Python
- **Database:** Supabase PostgreSQL, managed with SQLAlchemy and Alembic migrations
- **Main users:** customers, branch staff, managers, and owners

The manuscript must explain how the new behavior fits into the existing application. Do not describe it as a separate booking system.

### Research and accuracy requirements

Before writing, inspect the repository and verify each claim against the current source code, migration files, API schemas, and available test/build results. Treat the sections below as a guide to changes that should be investigated, not permission to claim details that the code does not support.

- Distinguish implemented behavior from proposed improvements and operational recommendations.
- Do not invent staff members, machine inventory, database records, test results, API routes, or production deployments.
- Explain limits and assumptions plainly. In particular, determine whether each equipment capacity is stored in the database or represented by a code setting.
- If a feature is only partly implemented, state exactly what is complete and what remains.
- Do not include credentials, private customer details, payment references, or other secrets.
- Use the project’s actual route names, schema names, database table names, migration revision, and file names where relevant.
- Use formal but readable language suitable for a software engineering manuscript or system documentation.

### Changes to investigate and document

#### 1. Owner performance and forecasting periods

Document the owner dashboard’s period filters and forecasting controls. Verify the available periods, including weekly, monthly, and yearly; explain how a selected period affects the displayed performance or forecast data. Identify the frontend controls and corresponding backend endpoints, calculations, and date boundaries. Include daily filters only where present in the relevant dashboard.

#### 2. Customer dashboard reliability and timezone handling

Explain the dashboard loading issue where valid branch and service data could be hidden when another dashboard request failed. Document the frontend behavior that now handles dashboard and branch responses independently, and the backend handling of timezone-aware and timezone-naive appointment timestamps. Explain the database schema mismatch that was found for group-booking fields and identify the migration used to resolve it. Do not claim that a live deployment was updated unless verified from deployment records.

#### 3. Integrated group booking

Describe how a customer creates one booking for multiple people through the existing booking flow. Cover:

- Individual or group booking selection
- Main booker and group-member information
- Separate service selections for each person
- Different services per person and the same service selected by multiple people
- One group booking reference linked to the member and service records
- Group size configuration and current service-assignment limits
- Customer review, payment, and confirmation steps

Verify and state the current configured maximum number of people, including the main booker, and any separate maximum on service assignments. Explain that these are distinct constraints.

Describe the relational design using the actual schema. The group design is intended to reuse existing customers, branches, services, staff, and bookings. Verify fields on `bookings`, `group_booking_members`, and `booking_service_items`, including group reference, member linkage, individual service status, staff assignment, service price and duration, and appointment start/end times. Identify the Alembic revision and summarize its upgrade and downgrade behavior.

#### 4. Group scheduling and capacity feedback

Explain how the system checks branch and date validity, appointment lead time, opening hours, service durations, staff availability, overlapping assignments, equipment/resource capacity, and whole-group booking feasibility. Describe how unavailable times are presented and how alternative times are suggested where supported.

Document the group-specific availability endpoint and explain how the picker now sends each member’s service assignments rather than a flattened service list. Explain that the picker disables slots that fail the same scheduling and resource checks used when submitting the booking.

Document the group capacity summary shown to customers:

- Peak number of staff required simultaneously for the selected group
- Active branch staff count used by the system
- Required equipment/resource counts and configured capacities where available
- The distinction between total group service-minutes and the longest individual guest visit

State clearly that active staff headcount is based on real active staff records; software changes do not create employees. Verify the current equipment capacity implementation. If facial-machine or hair-tool capacities remain hard-coded rather than managed through an inventory screen, state that limitation and do not call the values live inventory.

#### 5. Staff and manager booking operations

Describe the staff and manager booking interfaces for viewing group references, member details, individual service assignments, assigned providers, and statuses. Document staff reassignment, service completion, and individual service cancellation behavior. Explain that cancelling one group service should not automatically cancel other members’ services.

Document the staff reschedule workflow for eligible paid online bookings. Explain that it updates the original booking, checks schedule availability, keeps the verified payment attached, does not collect payment again for the reschedule, and follows the non-refundable policy. State which booking statuses can be rescheduled and identify any restrictions.

Describe any change that allows staff to process eligible bookings before the appointment date. List the relevant operations and their remaining status, payment, branch, availability, and authorization checks. Do not imply that staff may mark work complete before service is performed unless that behavior is explicitly intended and verified.

#### 6. Payment, transactions, and completion

Explain the existing online payment workflow, including GCash proof submission and staff verification, PayPal order/capture handling, transaction recording, and duplicate-charge prevention. Verify which payment decisions create or update a transaction.

Document the paid-booking non-refundable policy. Explain how rescheduling retains the existing payment and how cancellation behavior differs from a refund.

Explain when a treatment-done booking leaves the active online bookings list and where its completed payment is visible. Distinguish booking status from transaction status and avoid describing a payment as newly collected if it was already verified online.

#### 7. Reports and analytics

Inspect the owner and manager report/forecasting code for group-booking integration. Explain how the system counts one group booking as one booking while counting service assignments separately where implemented. Describe revenue aggregation and how the implementation avoids double-counting. Include the period filters and forecasting changes only when verified in current code.

#### 8. Request performance and group availability optimization

Document the 15-second frontend timeout reported during booking submission, the endpoint-specific timeout configured for booking creation, and the backend optimization that reuses staff and booking data during repeated group-slot checks. Explain that a timeout indicates that the client did not receive a response within its configured limit; do not claim a specific production root cause without request logs.

### Required manuscript structure

Produce the document with these sections:

1. **Title page** — project name, document title, author placeholder, institution placeholder, and date placeholder.
2. **Abstract** — concise summary of the system changes, implementation approach, and verified outcomes.
3. **Introduction and project background** — salon management context and why the changes were needed.
4. **Problem statement** — describe the booking, dashboard, scheduling, payment, and reporting problems addressed.
5. **Objectives** — one general objective and specific, measurable objectives.
6. **Scope and limitations** — covered users, workflows, branches, data, technical constraints, and exclusions.
7. **System architecture and technology stack** — React/Tailwind frontend, FastAPI backend, Supabase PostgreSQL, and request/data flow.
8. **Requirements and business rules** — functional and non-functional requirements, booking rules, group rules, payment rules, and authorization.
9. **Design and data model** — explain relevant entities and relationships. Add a concise Mermaid ER diagram if it accurately matches the schema.
10. **Implementation** — organize by customer, staff, manager, owner, backend, database, scheduling, payments, and analytics.
11. **API changes** — table with method, route, actor, purpose, and validation behavior. Include only routes verified in source code.
12. **User workflows** — individual booking, group booking, unavailable-time handling, staff rescheduling, payment verification, treatment completion, and completed transaction viewing.
13. **Security and data integrity** — branch scoping, role authorization, transactional writes, foreign keys, duplicate-charge prevention, and private payment proof handling where verified.
14. **Testing and verification** — list the checks actually performed with results and dates if available. Separate code linting, builds, syntax checks, and automated tests. Do not claim unrun tests passed.
15. **Results and discussion** — explain how the implemented behavior addresses the stated problems and identify any limits.
16. **Known limitations and future work** — especially configurable equipment inventory, explicit staff qualifications/schedules if not modeled, and any remaining capacity or reporting gaps.
17. **Conclusion** — summarize the verified contribution and operational impact.
18. **References and appendices** — repository files, migration identifiers, API route list, selected screen descriptions, and glossary.

### Presentation requirements

- Use consistent headings, numbered requirements, tables for API and role comparisons, and concise paragraphs.
- Define terms such as group booking, service assignment, booking status, payment status, capacity, and rescheduling at first use.
- Include one example group with five people, making clear that the number of staff needed depends on overlapping service assignments, staff availability, and equipment requirements.
- Do not promise that five guests can always book simultaneously. Explain that a particular time is bookable only when the branch’s actual staff and configured resources can accommodate the group.
- Include a short “Implementation status” table with columns: feature, status, evidence/source, and limitation.
- If any requested feature in this prompt is absent or only partly implemented, mark it as partial or future work rather than presenting it as complete.
- End with a concise summary of modified source files, migration changes, APIs, and the most recent verified checks.

Before finalizing, compare every factual statement with the repository and remove any unsupported claim.

---

## Notes for the manuscript author

This prompt is designed to generate documentation from the codebase. The resulting manuscript should still be reviewed against the deployed environment, institutional manuscript format, and actual branch staffing/equipment inventory before submission.
