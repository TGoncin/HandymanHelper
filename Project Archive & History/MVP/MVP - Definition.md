# HandymanHelper - Minimum Viable Product (MVP)

## Goal
Deliver a minimal working version of HandymanHelper that supports job posting and bidding between two user roles (Client and Contractor), while enforcing key business rules (e.g., verified contractors only)

## Core User Roles
- **Client**: posts jobs (or ads) and closes their own jobs when completed.
- **Contractor**: places bids on open jobs.
- **Verified Contractor Rule**: only verified contractors can place bids.

## MVP Features
### Job Posting (Client)
- Client can create a job (ad) with:
  - title (required)
  - description (required)
  - budget (must be > 0 if provided)
- Jobs start in **OPEN** state.

### Bidding (Contractor)
- Contractor can place a bid on a job if:
  - the job exists
  - the job is OPEN status
  - the user exists and is a CONTRACTOR
  - the contractor is VERIFIED
  - bid amount is > 0
 
### Close Job (Client)
- Client can close a job if:
  - the job exists
  - the user exists and is a CLIENT
  - the client is the job owner
  - the job is currently OPEN

## Success Criteria
The MVP is considered successful if:
- Clients can post jobs successfully under valid inputs.
- Verified contractors can bid on open jobs, and invalid cases are rejected correctly.
- Clients can close only their own jobs, and closed jobs no longer accept bids.
- All decision table test cases pass.

