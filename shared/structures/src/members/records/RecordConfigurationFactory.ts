import { Country } from "../../addresses/CountryDecoder"
import { PropertyFilter } from "../../filters/PropertyFilter"
import { OrganizationType } from "../../OrganizationType"
import { DataPermissionsSettings, OrganizationRecordsConfiguration } from "../OrganizationRecordsConfiguration"
import { LegacyRecordType } from "./LegacyRecordType"
import { RecordCategory } from "./RecordCategory"
import { RecordFactory } from "./RecordFactory"

export class RecordConfigurationFactory {
    static create(type: OrganizationType, country: Country): OrganizationRecordsConfiguration {
        const recordCategories = this.getDefaultRecordCategoriesFor(type, country)
        const configuration = OrganizationRecordsConfiguration.create({
            recordCategories,
        })

        this.setDefaultBuiltInFields(configuration, type)
        this.setDefaultParents(configuration, type)
        this.setDefaultEmergencyContacts(configuration, type)
        this.setDefaultDataPermissions(configuration, type)

        return configuration
    }

    /**
     * Set default email, phone, partents, ... configuration
     * Except emergency contacts
     */
    static setDefaultBuiltInFields(configuration: OrganizationRecordsConfiguration, type: OrganizationType) {
        configuration.gender = PropertyFilter.createDefault()
        configuration.birthDay = PropertyFilter.createDefault()

        configuration.phone = new PropertyFilter(
            {
                age: {
                    $gt: 10
                }
            },
            {
                age: {
                    $gt: 17
                }
            }
        )
        configuration.emailAddress = new PropertyFilter(
            {
                age: {
                    $gt: 10
                }
            },
            {
                age: {
                    $gt: 17
                }
            }
        )

        // Only make address optional for youth and sport organizations for now
        if (type === OrganizationType.Youth || [OrganizationType.Student ,OrganizationType.Sport, OrganizationType.Athletics, OrganizationType.Football, OrganizationType.Hockey, OrganizationType.Tennis, OrganizationType.Volleyball, OrganizationType.Swimming, OrganizationType.HorseRiding, OrganizationType.Basketball, OrganizationType.Dance, OrganizationType.Cycling, OrganizationType.Judo].includes(type)) {
            configuration.address = new PropertyFilter(
                {
                    age: {
                        $gt: 17
                    }
                },
                {
                    age: {
                        $gt: 29
                    }
                }
            )
        } else {
            configuration.address = PropertyFilter.createDefault()
        }

    }

    static setDefaultParents(configuration: OrganizationRecordsConfiguration, type: OrganizationType) {
        // For now, only enable parents for youth and sport organizations
        if (type === OrganizationType.Youth || [OrganizationType.Student ,OrganizationType.Sport, OrganizationType.Athletics, OrganizationType.Football, OrganizationType.Hockey, OrganizationType.Tennis, OrganizationType.Volleyball, OrganizationType.Swimming, OrganizationType.HorseRiding, OrganizationType.Basketball, OrganizationType.Dance, OrganizationType.Cycling, OrganizationType.Judo].includes(type)) {
            configuration.parents = new PropertyFilter(
                {
                    age: {
                        $lt: 30
                    }
                },
                {
                    $or: [
                        {
                            age: {
                                $lt: 18
                            }
                        },
                        {
                            address: null
                        }
                    ]
                }
            )
        }
    }

    static setDefaultEmergencyContacts(configuration: OrganizationRecordsConfiguration, type: OrganizationType) {
        // For now, only enable parents for youth and sport organizations
        if (type === OrganizationType.Youth || [OrganizationType.Student ,OrganizationType.Sport, OrganizationType.Athletics, OrganizationType.Football, OrganizationType.Hockey, OrganizationType.Tennis, OrganizationType.Volleyball, OrganizationType.Swimming, OrganizationType.HorseRiding, OrganizationType.Basketball, OrganizationType.Dance, OrganizationType.Cycling, OrganizationType.Judo].includes(type)) {
            configuration.emergencyContacts = new PropertyFilter(
                {
                    age: {
                        $lt: 30
                    }
                }, 
                {
                    $or: [
                        {
                            age: {
                                $lt: 18
                            }
                        },
                        {
                            parents: {
                                $length: 0
                            }
                        }
                    ]
                }
            )
        } else if (type === OrganizationType.LGBTQ) {
            // Optional emergency contact
            configuration.emergencyContacts = new PropertyFilter(
                null, 
                null
            )
        }
    }

    static setDefaultDataPermissions(configuration: OrganizationRecordsConfiguration, type: OrganizationType) {
        // For now, only enable parents for youth and sport organizations
        if (configuration.recordCategories.flatMap(c => c.getAllRecords()).find(r => r.sensitive)) {
            configuration.dataPermission = DataPermissionsSettings.create({})
        }

        if (type === OrganizationType.LGBTQ || type === OrganizationType.Politics || type === OrganizationType.Union) {
            // Sensitive membership: need to ask permission
            configuration.dataPermission = DataPermissionsSettings.create({})
        }
    }

    static getDefaultRecordCategoriesFor(type: OrganizationType, country: Country): RecordCategory[] {
        if (type === OrganizationType.Youth && country === Country.Belgium) {
            // Enable all
            const recordCategories = RecordFactory.convert(Object.values(LegacyRecordType))

            // Ask doctor (required)
            recordCategories.push(RecordFactory.createDoctorCategory(true))

            return recordCategories
        }

        // Others are all disabled by default
        return []
    }
}
