ID: Validity Check Only. Ignore mismatch with Reference. Error ONLY if Target is 0, negative, or null. (Dont Flag if all References are 0)

UUID: Existence Check. Ignore mismatch. Error ONLY if Target is null or an empty string.

Date: Dates are expected to slighlty differ (days, weeks, up to a month). Warnings if major differences. Error for invalid formats.

Boolean: Error if Target boolean logic differs from all References. If References vary between themselves, Warning.

Integer: Integers Target values make sense regarding Reference.

Float: Financial Strict Match. Treat null, blank, and 0.0 as equal. Any other deviation from Reference is a CRITICAL error.

String: Warnings for typos. Ignore semantic mismatch if References have major semantic mismatch between them.