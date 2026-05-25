import { Button } from "@/components/ui/button";
import { TIMESHEET_QUICK_STATE_CODES } from "@/modules/hr-timesheets/constants";
import { registerTimesheetStatusAction } from "@/modules/hr-timesheets/actions";
import type { TimesheetState } from "@/modules/hr-timesheets/types";

type TimesheetStatusActionsProps = {
  limit?: number;
  redirectTo?: string;
  states: TimesheetState[];
};

function sortQuickStates(states: TimesheetState[], limit: number) {
  const byCode = new Map(states.map((state) => [state.code, state]));
  const quickStates = TIMESHEET_QUICK_STATE_CODES.map((code) => byCode.get(code))
    .filter((state): state is TimesheetState => Boolean(state))
    .slice(0, limit);

  if (quickStates.length > 0) {
    return quickStates;
  }

  return states.slice(0, limit);
}

export function TimesheetStatusActions({
  limit = 6,
  redirectTo,
  states,
}: TimesheetStatusActionsProps) {
  const quickStates = sortQuickStates(states, limit);

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {quickStates.map((state) => (
        <form action={registerTimesheetStatusAction} key={state.id}>
          <input name="estadoCodigo" type="hidden" value={state.code} />
          {redirectTo ? (
            <input name="redirectTo" type="hidden" value={redirectTo} />
          ) : null}
          <Button
            className="w-full justify-center"
            size="sm"
            style={
              state.color
                ? {
                    borderColor: state.color,
                    color: state.color,
                  }
                : undefined
            }
            type="submit"
            variant="outline"
          >
            {state.name}
          </Button>
        </form>
      ))}
    </div>
  );
}
