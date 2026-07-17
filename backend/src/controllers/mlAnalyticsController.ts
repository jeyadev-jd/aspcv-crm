import { Request, Response } from 'express';
import { exec } from 'child_process';
import path from 'path';

export const getMLForecast = async (req: Request, res: Response) => {
  try {
    const pythonScriptPath = path.join(__dirname, '../../ml/analytics_model.py');
    // We try to use the virtual env python if it exists, otherwise fallback to python3
    const venvPythonPath = path.join(__dirname, '../../ml/venv/bin/python');
    
    // Command uses fallback logic if venv doesn't exist
    const command = `if [ -f "${venvPythonPath}" ]; then "${venvPythonPath}" "${pythonScriptPath}"; else python3 "${pythonScriptPath}"; fi`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing ML script:', error);
        console.error('stderr:', stderr);
        // We still send a 200 with fallback empty data so the frontend doesn't break
        return res.json({
          status: "error",
          message: "ML model execution failed. Dependencies might be missing.",
          data: {
             sales: { historical: [], nextMonthForecast: 0 },
             inventory: { historical: [], nextMonthForecast: 0 },
             liabilities: { historical: [], nextMonthForecast: 0 },
             assets: { historical: [], nextMonthForecast: 0 }
          }
        });
      }

      try {
        // sometimes python scripts output warnings before JSON. We can try to extract the JSON object.
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : stdout;
        const result = JSON.parse(jsonStr);
        return res.json(result);
      } catch (parseError) {
        console.error('Error parsing ML script output:', parseError);
        console.error('Output was:', stdout);
        // Fallback gracefully so frontend doesn't break
        return res.json({
          status: "error",
          message: "Failed to parse ML output",
          data: {
             sales: { historical: [], nextMonthForecast: 0 },
             inventory: { historical: [], nextMonthForecast: 0 },
             liabilities: { historical: [], nextMonthForecast: 0 },
             assets: { historical: [], nextMonthForecast: 0 }
          }
        });
      }
    });
  } catch (error) {
    console.error('Controller error:', error);
    res.json({
          status: "error",
          message: "Internal server error",
          data: {
             sales: { historical: [], nextMonthForecast: 0 },
             inventory: { historical: [], nextMonthForecast: 0 },
             liabilities: { historical: [], nextMonthForecast: 0 },
             assets: { historical: [], nextMonthForecast: 0 }
          }
    });
  }
};
