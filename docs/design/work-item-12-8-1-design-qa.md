# Work item 12.8.1 design QA

## Reviewed surface

- Private owner login at `http://localhost:3001/login`
- Desktop viewport: 1280px wide
- Mobile viewport: 390×844

## Findings and changes

- Preserved the console's blue-grey foundation and used mint/amber only for operational state.
- Kept the two-column desktop composition: system boundary on the left and one authentication task on the right.
- Removed mobile horizontal scrolling from the boundary map by converting it to a vertical evidence strip below 430px.
- Reduced and wrapped the mobile headline so no text or card crosses the viewport.
- Kept visible labels, password autocomplete, a generic error summary, and keyboard-native form controls.

## Acceptance evidence

- Desktop document width equals viewport width.
- At 390px the document is 375 CSS pixels wide and no element extends beyond the viewport.
- Wrong credentials remain on `/login` and show `用户名或密码不正确` without identifying whether the account exists.
- The page exposes no registration, recovery, demo metrics, or public navigation.
