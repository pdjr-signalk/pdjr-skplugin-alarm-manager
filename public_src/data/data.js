export const contentOptions = [
    {
        label: "Name properties",
        options: [
            { label: "Display name", value: { displayName: "" } },
            { label: "Long name", value: { longName: "" } },
            { label: "Short name", value: { shortName: "" } },
            { label: "All names", value: { displayName: "", longName: "", shortName: "" } }
        ]
    },
    {
        label: "Alarm methods",
        options: [
            { label: "Alert method", value: { alertMethod: [ "sound", "visual" ] } },
            { label: "Warn method", value: { warnMethod: [ "sound", "visual" ] } },
            { label: "Alarm method", value: { alarmMethod: [ "sound", "visual" ] } },
            { label: "Emergency method", value: { emergencyMethod: [ "sound", "visual" ] } },
            { label: "All methods", value: { alertMethod: [ "sound", "visual" ], warnMethod: [ "sound", "visual" ], alarmMethod: [ "sound", "visual" ], emergencyMethod: [ "sound", "visual" ] } }
        ]
    },
    {
        label: "Zones",
        options: [
            { label: "Lower", value: { zones: [ { lower: 0.5, state: "alert", message: "Value above 50%" } ] }},
            { label: "Upper", value: { zones: [ { upper :0.5, state: "alert", message: "Value below 50%" } ] }},
            { label: "Both", value: { zones: [ { lower: 0.5, state: "alert", message: "Value above 50%" }, { upper :0.5, state: "alert", message: "Value below 50%" } ] }}
        ]
    }
]
