import { ObjectData } from "@simonbackx/simple-encoding";

import { GroupGenderType } from "./GroupGenderType";
import { GroupSettings, WaitingListType } from "./GroupSettings";
import { ReservedSeat, SeatingPlan, SeatingPlanRow, SeatingPlanSeat, SeatingPlanSection, SeatType } from "./SeatingPlan";


describe("SeatingPlan", () => {
    describe('adjustSeatsForBetterFit', () => {
        function expectAdjustedSeats(input: string, output: string) {
            const reserved: ReservedSeat[] = [];
            const selected: ReservedSeat[] = [];
            const seats: SeatingPlanSeat[] = [];
            const expectedResponse: ReservedSeat[] = [];

            // - = available seat
            // R = reserved seat
            // X = selected seat
            //   = hallway

            for (const [i, char] of input.split('').entries()) {
                if (char == 'R') {
                     seats.push(SeatingPlanSeat.create({
                        label: (i+1).toString()
                    }))
                    reserved.push(ReservedSeat.create({
                        section: 'm',
                        row: 'A',
                        seat: (i+1).toString()
                    }));
                } else if (char == 'X') {
                    seats.push(SeatingPlanSeat.create({
                        label: (i+1).toString()
                    }))
                    selected.push(ReservedSeat.create({
                        section: 'm',
                        row: 'A',
                        seat: (i+1).toString()
                    }));
                } else if (char == '-') {
                    // Available seat
                    seats.push(SeatingPlanSeat.create({
                        label: (i+1).toString()
                    }))

                } else if (char == ' ') {
                    // Hall
                    seats.push(SeatingPlanSeat.create({
                        type: SeatType.Space,
                        label: ''
                    }))
                } else {
                    throw new Error("Invalid character " + char)
                }
            }

            for (const [i, char] of output.split('').entries()) {
                if (char == 'X') {
                    expectedResponse.push(ReservedSeat.create({
                        section: 'm',
                        row: 'A',
                        seat: (i+1).toString()
                    }));
                } 
            }

            const seatingPlan = SeatingPlan.create({
                sections: [
                    SeatingPlanSection.create({
                        id: 'm',
                        rows: [
                            SeatingPlanRow.create({
                                label: 'A',
                                seats
                            })
                        ]
                    })
                ]
            });

            const adjusted = seatingPlan.adjustSeatsForBetterFit(selected, reserved);

            if (input === output) {
                // Nothing should have changed
                expect(adjusted).toBe(null);
            } else {
                expect(adjusted).toIncludeAllMembers(expectedResponse);
            }
        }

        // eslint-disable-next-line jest/expect-expect
        test('Seats move to the left is needed', () => {
            expectAdjustedSeats(
                '-XX-----', 
                'XX------'
            );
            expectAdjustedSeats(
                '-XXX----', 
                'XXX-----'
            );
            expectAdjustedSeats(
                '-XX-R---', 
                'XX--R---'
            );

            expectAdjustedSeats(
                '-XXX-', 
                'XXX--'
            );

            expectAdjustedSeats(
                'RR-X-RR', 
                'RRX--RR'
            );
            expectAdjustedSeats(
                'RR-XX-RR', 
                'RRXX--RR'
            );
            expectAdjustedSeats(
                'RR-XXX-RR', 
                'RRXXX--RR'
            );

            expectAdjustedSeats(
                '--  -XXX-  --', 
                '--  XXX--  --'
            );

            expectAdjustedSeats(
                '--XXX-XX---', 
                '--XXXXX----'
            );
        });
        
        // eslint-disable-next-line jest/expect-expect
        test('Seats remaing the same if needed', () => {
            expectAdjustedSeats(
                '-XXR---', 
                '-XXR---'
            );
            expectAdjustedSeats(
                '-XXX', 
                '-XXX'
            );
            expectAdjustedSeats(
                'XXX-', 
                'XXX-'
            );
            expectAdjustedSeats(
                'XXX', 
                'XXX'
            );
 
            expectAdjustedSeats(
                '--XXX--', 
                '--XXX--'
            );
            expectAdjustedSeats(
                '-RXXX-RR', 
                '-RXXX-RR'
            );
            expectAdjustedSeats(
                'RR-XRR', 
                'RR-XRR'
            );

            expectAdjustedSeats(
                '--  XXX  --', 
                '--  XXX  --'
            );
            expectAdjustedSeats(
                '--  XXX-  --', 
                '--  XXX-  --'
            );
            expectAdjustedSeats(
                '--  -XXX  --',
                '--  -XXX  --'
            );

            expectAdjustedSeats(
                '--RRRRRXXXX-RRRRR', 
                '--RRRRRXXXX-RRRRR'
            );

            expectAdjustedSeats(
                '--RRRRRXXXX--RRRRR', 
                '--RRRRRXXXX--RRRRR'
            );

            expectAdjustedSeats(
                '--RRRRR--XXXX--RRRRR', 
                '--RRRRR--XXXX--RRRRR'
            );
        });
        
        // eslint-disable-next-line jest/expect-expect
        test('Seats move to the right if needed', () => {
            expectAdjustedSeats(
                '------X-', 
                '-------X'
            );
            expectAdjustedSeats(
                '------XX-', 
                '-------XX'
            );
            expectAdjustedSeats(
                '------XXX-', 
                '-------XXX'
            );

            expectAdjustedSeats(
                '--  --XXX-  --', 
                '--  ---XXX  --'
            );

            expectAdjustedSeats(
                '--  --XXX-RRR  --', 
                '--  ---XXXRRR  --'
            );
        });
        
        // eslint-disable-next-line jest/expect-expect
        test('Combination of multiple moves in the same row', () => {
            expectAdjustedSeats(
                '-X-----X-', 
                'X-------X'
            );

            expectAdjustedSeats(
                '--RRRRR-XX---X-RRRRR-X-', 
                '--RRRRRXX-----XRRRRRX--'
            );
        })
    });
    
});
