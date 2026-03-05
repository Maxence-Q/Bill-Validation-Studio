ID: Validity Check Only. Ignore mismatch with Reference. Error ONLY if Target is 0, negative, or null. (Dont Flag if target is 0 AND all References are 0)

UUID: Existence Check. Ignore mismatch. Error ONLY if Target is null or an empty string.

Date: Dates are expected to slighlty differ (days, weeks, up to 1-2 months). No errors if target value slighlty differ from ONE REFERENCE. Warnings if major differences with all references. Error if target value has invalid formats.

Boolean: Error if Target boolean logic differs from all References. If References vary but have a majority, target must have the value of the majority. Error ortherwise.

Integer: Integers Target values make sense regarding at least one Reference.

Float: Strict match to at least one Reference. Error otherwise.

String: Warnings for typos. Ignore semantic mismatch if References have semantic mismatch between them. Warning empty target.